"use client";

import { useState, useTransition } from "react";
import {
  approveRecommendationAction,
  rejectRecommendationAction,
  exportRecommendationForRCAction,
  markManualAppliedAction,
  markApplyFailedAction,
} from "./actions";
import type { PricingRecommendation, AuditLogEntry, RCExportResponse } from "@/lib/adminApi";

const REC_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  gap_special_price:    { label: "Спеццена",        cls: "bg-yellow-100 text-yellow-800" },
  raise_price:          { label: "↑ Повысить",      cls: "bg-green-100 text-green-800"  },
  lower_price:          { label: "↓ Снизить",       cls: "bg-red-100 text-red-800"      },
  hold_price:           { label: "= Держать",       cls: "bg-gray-100 text-gray-600"    },
  gap_fill_aggressive:  { label: "⚡ Агрессивно",   cls: "bg-orange-100 text-orange-800"},
  gap_fill_moderate:    { label: "↗ Умеренно",      cls: "bg-blue-100 text-blue-800"    },
  gap_fill_soft:        { label: "→ Мягко",         cls: "bg-sky-100 text-sky-800"      },
  discount_no_market:   { label: "↓ Скидка (нет рынка)", cls: "bg-gray-100 text-gray-500"},
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:            { label: "черновик",           cls: "bg-gray-100 text-gray-500"    },
  approved:         { label: "одобрено",            cls: "bg-blue-100 text-blue-700"    },
  applied:          { label: "применено",           cls: "bg-green-100 text-green-700"  },
  rejected:         { label: "отклонено",           cls: "bg-red-100 text-red-600"      },
  exported:         { label: "экспортировано",      cls: "bg-amber-100 text-amber-700"  },
  manually_applied: { label: "✓ применено вручную", cls: "bg-green-100 text-green-700"  },
  apply_failed:     { label: "✗ ошибка применения", cls: "bg-red-100 text-red-700"      },
};

const AUDIT_LABELS: Record<string, { label: string; cls: string }> = {
  approve:             { label: "✓ одобрено",             cls: "bg-blue-100 text-blue-700"   },
  reject:              { label: "✗ отклонено",             cls: "bg-red-100 text-red-600"     },
  export_rc_manual:    { label: "⇥ экспортировано",        cls: "bg-amber-100 text-amber-700" },
  manual_applied:      { label: "✓ применено вручную",     cls: "bg-green-100 text-green-700" },
  manual_apply_failed: { label: "✗ ошибка применения",     cls: "bg-red-100 text-red-700"     },
};

const TABLE_HEADERS = [
  "Номер",
  "Период",
  "Тип",
  "Текущая ₽",
  "Рынок ₽",
  "Гость ₽",
  "RC net ₽",
  "Прямая ₽",
  "Выгода прямой",
  "Увер.",
  "Причина",
  "Статус",
  "Действия",
] as const;

const COL_SPAN = TABLE_HEADERS.length;

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n as number)) return fallback;
  return (n as number).toLocaleString("ru-RU");
}

function guestTarget(rec: PricingRecommendation): number {
  return rec.recommended_guest_price ?? rec.recommended_price;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      //
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
    >
      {copied ? "✓ скопировано" : label}
    </button>
  );
}

function ExportPanel({ result }: { result: RCExportResponse }) {
  const pricesJson = JSON.stringify(result.prices_obj ?? {}, null, 2);
  const instructionText = result.instruction_lines
    ? result.instruction_lines.join("\n")
    : result.manual_instruction ?? "";

  const rc = result.rc_net_price;
  const aggGuest = result.expected_aggregator_guest_price;
  const direct = result.direct_price;
  const gsave = result.direct_savings_for_guest;
  const ogain = result.direct_owner_gain;
  const pct = result.aggregator_markup_percent;

  return (
    <div className="mt-3 space-y-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-amber-900">
          Экспорт готов — только ручное внесение в RealtyCalendar
        </span>
        {result.nights != null && (
          <span className="text-xs text-amber-800">
            ({result.nights} ночей · {result.date_from} → {result.date_to})
          </span>
        )}
      </div>

      {(rc != null || aggGuest != null) && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white border border-amber-200 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Цена для RealtyCalendar</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(rc)} ₽</p>
            <p className="text-xs text-gray-500 mt-1">Net на ночь для prices_obj (агрегатор сверху)</p>
          </div>
          <div className="rounded-xl bg-white border border-amber-200 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Ожидаемая цена гостя на агрегаторе</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(aggGuest ?? result.recommended_guest_price)} ₽</p>
            {pct != null && (
              <p className="text-xs text-gray-500 mt-1">С учётом наценки ~{fmt(pct)}%</p>
            )}
          </div>
        </div>
      )}

      {direct != null && (
        <div className="rounded-xl bg-white border border-teal-200 px-4 py-3 text-sm text-gray-800">
          <p className="text-xs font-semibold text-teal-900 uppercase tracking-wide mb-2">Прямая цена</p>
          <p className="text-xl font-bold text-gray-900">{fmt(direct)} ₽ <span className="text-sm font-normal text-gray-500">/ ночь</span></p>
          <ul className="mt-2 space-y-1 text-gray-700">
            <li>Гость экономит: <span className="font-semibold">{fmt(gsave)} ₽</span> / ночь (vs агрегатор)</li>
            <li>Вы получаете больше: <span className="font-semibold">{fmt(ogain)} ₽</span> / ночь (vs net RC)</li>
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-100/40 px-3 py-2 text-xs text-amber-950 leading-relaxed">
        <p className="font-semibold mb-1">Почему цена в RealtyCalendar ниже рыночной?</p>
        <p>
          Агрегаторы добавляют свою комиссию/наценку. Поэтому в RealtyCalendar ставится net price, чтобы итоговая цена для гостя соответствовала рынку.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Цены (JSON, net)</span>
          <CopyButton text={pricesJson} label="Копировать JSON" />
        </div>
        <pre className="bg-white border border-gray-200 rounded p-2 text-xs text-gray-800 overflow-x-auto max-h-48 font-mono">
          {pricesJson}
        </pre>
      </div>

      {instructionText && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">Инструкция</span>
            <CopyButton text={instructionText} label="Копировать инструкцию" />
          </div>
          <pre className="bg-white border border-gray-200 rounded p-2 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {instructionText}
          </pre>
        </div>
      )}

      {result.audit_id && (
        <p className="text-xs text-gray-400">audit_id: {result.audit_id}</p>
      )}
    </div>
  );
}

function RecRow({
  rec,
  onDone,
}: {
  rec: PricingRecommendation;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<RCExportResponse | null>(null);
  const [localStatus, setLocalStatus] = useState<string>(rec.status ?? "");

  const status = localStatus || (rec.status ?? "");
  const canApprove  = status === "draft" || status === "rejected" || status === "apply_failed";
  const canReject   = status === "draft" || status === "approved";
  const canExport   = status === "approved";
  const canMarkApplied = status === "exported";
  const canMarkFailed  = status === "exported";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) => {
    setErr(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { setErr(res.error ?? "Ошибка"); return; }
      onSuccess?.();
      onDone();
    });
  };

  const handleApprove = () =>
    run(() => approveRecommendationAction(rec.id ?? "", "Одобрено владельцем"));
  const handleReject  = () =>
    run(() => rejectRecommendationAction(rec.id ?? "", "Отклонено владельцем"));

  const handleExport = () => {
    setErr(null);
    startTransition(async () => {
      const res = await exportRecommendationForRCAction(rec.id ?? "");
      if (!res.ok) { setErr(res.error ?? "Ошибка экспорта"); return; }
      if (res.data) setExportResult(res.data);
      setLocalStatus("exported");
    });
  };

  const handleMarkApplied = () =>
    run(() => markManualAppliedAction(rec.id ?? ""), () => setLocalStatus("manually_applied"));

  const handleMarkFailed = () =>
    run(() => markApplyFailedAction(rec.id ?? ""), () => setLocalStatus("apply_failed"));

  const recMeta  = REC_TYPE_LABELS[rec.recommendation_type ?? ""] ?? {
    label: rec.recommendation_type ?? "—",
    cls: "bg-gray-100 text-gray-600",
  };
  const statMeta = STATUS_LABELS[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  const conf = rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : "—";

  const g = guestTarget(rec);
  const rc = rec.rc_net_price;
  const d = rec.direct_price;
  const ogs = rec.direct_owner_gain;
  const gsave = rec.direct_savings_for_guest;

  return (
    <>
      <tr className={`hover:bg-gray-50 align-top ${isPending ? "opacity-50" : ""}`}>
        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">№{rec.apartment_id}</td>
        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
          {rec.date_from} — {rec.date_to}
          <br /><span className="text-gray-400 text-xs">{rec.nights} н.</span>
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${recMeta.cls}`}>
            {recMeta.label}
          </span>
        </td>
        <td className="px-3 py-3 text-right text-gray-600">
          {rec.current_price != null ? fmt(rec.current_price) : "—"}
        </td>
        <td className="px-3 py-3 text-right text-gray-600">
          {rec.market_median != null ? fmt(rec.market_median) : "—"}
        </td>
        <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmt(g)}</td>
        <td className="px-3 py-3 text-right text-indigo-900 font-medium">{rc != null ? fmt(rc) : "—"}</td>
        <td className="px-3 py-3 text-right text-teal-900 font-medium">{d != null ? fmt(d) : "—"}</td>
        <td className="px-3 py-3 text-right text-xs text-gray-700">
          {ogs != null && gsave != null ? (
            <>
              <span className="font-semibold text-teal-800">+{fmt(ogs)}</span>
              <span className="text-gray-400"> / </span>
              <span className="text-gray-600">гость −{fmt(gsave)}</span>
            </>
          ) : "—"}
        </td>
        <td className="px-3 py-3 text-center text-gray-500">{conf}</td>
        <td className="px-3 py-3 text-gray-600 max-w-[14rem] text-xs leading-relaxed">{rec.reason}</td>
        <td className="px-3 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statMeta.cls}`}>
            {statMeta.label}
          </span>
        </td>
        <td className="px-3 py-3 min-w-[220px]">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-1">
              {canApprove && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="px-2 py-1 text-xs rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors"
                >
                  ✓ Одобрить
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isPending}
                  className="px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                >
                  ✗ Отклонить
                </button>
              )}
              {canExport && (
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isPending}
                  className="px-2 py-1 text-xs rounded border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                >
                  ⇥ Экспорт в RealtyCalendar
                </button>
              )}
              {canMarkApplied && (
                <button
                  type="button"
                  onClick={handleMarkApplied}
                  disabled={isPending}
                  className="px-2 py-1 text-xs rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
                >
                  ✓ Применено вручную
                </button>
              )}
              {canMarkFailed && (
                <button
                  type="button"
                  onClick={handleMarkFailed}
                  disabled={isPending}
                  className="px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                >
                  ✗ Не удалось
                </button>
              )}
              {(status === "manually_applied" || status === "applied") && (
                <span className="px-2 py-1 text-xs text-gray-400 italic">— завершено</span>
              )}
              {status === "apply_failed" && !canApprove && (
                <span className="px-2 py-1 text-xs text-red-400 italic">— повторите approve</span>
              )}
            </div>
            {(status === "exported" || status === "manually_applied" || status === "apply_failed") && (
              <span className="text-xs text-gray-400 italic">
                API недоступен — используйте ручной экспорт
              </span>
            )}
            {err && <p className="text-red-500 text-xs">{err}</p>}
          </div>
        </td>
      </tr>

      {exportResult && (
        <tr>
          <td colSpan={COL_SPAN} className="px-3 pb-3">
            <ExportPanel result={exportResult} />
          </td>
        </tr>
      )}
    </>
  );
}

export function ApprovalsPanel({
  recs: initialRecs,
  auditLog,
}: {
  recs: PricingRecommendation[];
  auditLog: AuditLogEntry[];
}) {
  const [recs] = useState(initialRecs);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDone = () => setRefreshKey((k) => k + 1);

  if (recs.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Рекомендаций нет. Запустите пересчёт после обновления данных рынка.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border px-4 py-3 text-sm leading-relaxed"
        style={{ background: "#E8F4FF", borderColor: "#93C5FD", color: "#1E3A5F" }}
      >
        <p className="font-semibold mb-1">Почему цена в RealtyCalendar ниже рыночной?</p>
        <p className="text-gray-700">
          Агрегаторы добавляют свою комиссию/наценку. Поэтому в RealtyCalendar ставится net price, чтобы итоговая цена для гостя соответствовала рынку.
        </p>
      </div>

      <div className="aq-table-wrap overflow-x-auto">
        <table className="aq-table">
          <thead>
            <tr>
              {TABLE_HEADERS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody key={refreshKey}>
            {recs.map((r, i) => (
              <RecRow key={r.id ?? i} rec={r} onDone={handleDone} />
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">Журнал действий</h3>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-400">Действий пока нет.</p>
        ) : (
          <div className="aq-table-wrap">
            <table className="aq-table">
              <thead>
                <tr>
                  {["Время", "Действие", "Апарт.", "Период", "Статус до → после", "Цена до / рек.", "Причина"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.map((e) => {
                  const meta = AUDIT_LABELS[e.action] ?? {
                    label: e.action,
                    cls: "bg-gray-100 text-gray-600",
                  };
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {e.apartment_id ? `№${e.apartment_id}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {e.date_from && e.date_to ? `${e.date_from} — ${e.date_to}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {e.previous_status ?? "?"} → {e.new_status ?? "?"}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {e.old_price != null ? fmt(e.old_price) : "—"} /{" "}
                        {e.new_price != null ? fmt(e.new_price) : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs">{e.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
