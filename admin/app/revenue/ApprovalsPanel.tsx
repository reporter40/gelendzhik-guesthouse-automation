"use client";

import { useState, useTransition } from "react";
import { approveRecommendationAction, rejectRecommendationAction } from "./actions";
import type { PricingRecommendation, AuditLogEntry } from "@/lib/adminApi";

const REC_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  gap_special_price: { label: "Спеццена",     cls: "bg-yellow-100 text-yellow-800" },
  raise_price:       { label: "↑ Повысить",   cls: "bg-green-100 text-green-800"  },
  lower_price:       { label: "↓ Снизить",    cls: "bg-red-100 text-red-800"      },
  hold_price:        { label: "= Держать",    cls: "bg-gray-100 text-gray-600"    },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "черновик",  cls: "bg-gray-100 text-gray-500"   },
  approved: { label: "одобрено", cls: "bg-blue-100 text-blue-700"   },
  applied:  { label: "применено",cls: "bg-green-100 text-green-700" },
  rejected: { label: "отклонено",cls: "bg-red-100 text-red-600"     },
};

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n)) return fallback;
  return n.toLocaleString("ru-RU");
}

function RecRow({ rec, onDone }: { rec: PricingRecommendation; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const canApprove = rec.status === "draft" || rec.status === "rejected";
  const canReject  = rec.status === "draft" || rec.status === "approved";

  const handleApprove = () => {
    setErr(null);
    startTransition(async () => {
      const res = await approveRecommendationAction(rec.id ?? "", "Одобрено владельцем");
      if (!res.ok) setErr(res.error ?? "Ошибка");
      else onDone();
    });
  };

  const handleReject = () => {
    setErr(null);
    startTransition(async () => {
      const res = await rejectRecommendationAction(rec.id ?? "", "Отклонено владельцем");
      if (!res.ok) setErr(res.error ?? "Ошибка");
      else onDone();
    });
  };

  const recMeta  = REC_TYPE_LABELS[rec.recommendation_type] ?? { label: rec.recommendation_type, cls: "bg-gray-100 text-gray-600" };
  const statMeta = STATUS_LABELS[rec.status] ?? { label: rec.status, cls: "bg-gray-100 text-gray-500" };
  const conf = rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : "—";

  return (
    <tr className={`hover:bg-gray-50 ${isPending ? "opacity-50" : ""}`}>
      <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">№{rec.apartment_id}</td>
      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
        {rec.date_from} — {rec.date_to}
        <br /><span className="text-gray-400 text-xs">{rec.nights} н.</span>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${recMeta.cls}`}>{recMeta.label}</span>
      </td>
      <td className="px-3 py-3 text-right text-gray-600">{rec.current_price != null ? fmt(rec.current_price) : "—"}</td>
      <td className="px-3 py-3 text-right text-gray-600">{rec.market_median != null ? fmt(rec.market_median) : "—"}</td>
      <td className="px-3 py-3 text-right font-bold text-gray-900">{fmt(rec.recommended_price)}</td>
      <td className="px-3 py-3 text-center text-gray-500">{conf}</td>
      <td className="px-3 py-3 text-gray-600 max-w-xs text-xs">{rec.reason}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statMeta.cls}`}>{statMeta.label}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1 items-center">
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="px-2 py-1 text-xs rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ✓ Одобрить
            </button>
          )}
          {canReject && (
            <button
              onClick={handleReject}
              disabled={isPending}
              className="px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ✗ Отклонить
            </button>
          )}
          <button
            disabled
            title="Применение в RealtyCalendar — Phase C2.5"
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-300 cursor-not-allowed"
          >
            ↗ Apply (C2.5)
          </button>
        </div>
        {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
      </td>
    </tr>
  );
}

export function ApprovalsPanel({
  recs: initialRecs,
  auditLog,
}: {
  recs: PricingRecommendation[];
  auditLog: AuditLogEntry[];
}) {
  const [recs, setRecs] = useState(initialRecs);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDone = () => {
    setRefreshKey((k) => k + 1);
  };

  if (recs.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Рекомендаций нет. Workflow 12 (inactive) — запустите вручную или активируйте.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Номер", "Период", "Тип", "Текущая ₽", "Медиана ₽", "Рек. цена ₽", "Увер.", "Причина", "Статус", "Действия"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100" key={refreshKey}>
            {recs.map((r, i) => (
              <RecRow key={r.id ?? i} rec={r} onDone={handleDone} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Audit Log ── */}
      <div>
        <h3 className="text-base font-semibold text-gray-700 mb-2">Журнал действий</h3>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-400">Действий пока нет.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {["Время", "Действие", "Апарт.", "Период", "Статус до → после", "Цена до / рек.", "Причина"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {auditLog.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${
                        e.action === "approve" ? "bg-blue-100 text-blue-700" :
                        e.action === "reject"  ? "bg-red-100 text-red-600"  :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {e.action === "approve" ? "✓ одобрено" : e.action === "reject" ? "✗ отклонено" : e.action}
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
                      {e.old_price != null ? fmt(e.old_price) : "—"} / {e.new_price != null ? fmt(e.new_price) : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs">{e.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
