"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AuditLogEntry } from "@/lib/adminApi";
import {
  auditFilterToUrlValue,
  buildAuditLogSummary,
  filterAuditLogEntries,
  parseAuditFilter,
  scrollToAuditLogAnchor,
  shouldScrollToAuditLogFromSearchParams,
  type AuditLogFilter,
} from "@/lib/audit-log-summary";
import {
  buildReferralLeadExportRows,
  referralLeadExportFilename,
  referralLeadRowsToCsv,
  referralLeadRowsToTsv,
} from "@/lib/referral-lead-export";
import {
  isManualReferralLeadAudit,
  isPropertyContextSettingsAudit,
  normalizeManualReferralLeadAuditMetadata,
  normalizePropertyContextAuditMetadata,
  summarizeManualReferralLeadAudit,
  summarizePropertyContextAudit,
} from "@/lib/audit-metadata";

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n.toLocaleString("ru-RU");
}

function fmtRub(n: number | null | undefined) {
  if (n == null) return "—";
  return `${fmt(n)} ₽`;
}

function AuditActionBadge({ entry }: { entry: AuditLogEntry }) {
  if (isManualReferralLeadAudit(entry)) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
        ↗ referral lead
      </span>
    );
  }
  if (isPropertyContextSettingsAudit(entry)) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-800">
        PCS
      </span>
    );
  }
  const action = entry.action;
  const colors =
    action.includes("fail") ? "bg-red-100 text-red-800" :
    action.includes("applied") ? "bg-green-100 text-green-800" :
    action.includes("export") ? "bg-amber-100 text-amber-800" :
    action.includes("approv") ? "bg-purple-100 text-purple-800" :
    "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${colors}`}>
      {action}
    </span>
  );
}

function PcsAuditDetails({ entry }: { entry: AuditLogEntry }) {
  const n = normalizePropertyContextAuditMetadata(entry.metadata);
  if (!n.hadParsableEnvelope) return null;
  return (
    <details className="mt-1 text-xs text-gray-700">
      <summary className="cursor-pointer text-violet-800 font-medium">Детали PCS</summary>
      <ul className="mt-1 space-y-0.5 list-disc list-inside">
        <li>Добавлено ключей: {n.added_keys.join(", ") || "—"}</li>
        <li>Изменено: {n.changed_keys.join(", ") || "—"}</li>
        <li>Удалено: {n.removed_keys.join(", ") || "—"}</li>
        <li>
          Default: {n.previous_default_property_context ?? "—"} →{" "}
          {n.next_default_property_context ?? "—"}
        </li>
        <li>
          Размер map: {n.previous_size ?? "—"} → {n.next_size ?? "—"}
        </li>
      </ul>
      {n.rawObject && (
        <pre className="mt-2 max-h-32 overflow-auto rounded border border-gray-200 bg-white p-2 text-[10px]">
          {JSON.stringify(n.rawObject, null, 2)}
        </pre>
      )}
    </details>
  );
}

function ReferralLeadAuditDetails({ entry }: { entry: AuditLogEntry }) {
  const m = normalizeManualReferralLeadAuditMetadata(entry.metadata);
  if (!m.hadParsableEnvelope) return null;
  return (
    <details className="mt-1 text-xs text-gray-700">
      <summary className="cursor-pointer text-indigo-800 font-medium">Детали referral lead</summary>
      <dl className="mt-1 grid sm:grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <dt className="text-gray-500">Рекомендует</dt>
          <dd>{m.referrer_name ?? "—"} · {m.referrer_contact ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Рекомендуемый гость</dt>
          <dd>{m.referred_guest_name ?? "—"} · {m.referred_guest_contact ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Объект</dt>
          <dd>
            {m.apartment_name ?? "—"}
            {m.apartment_id ? ` (№${m.apartment_id})` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Период</dt>
          <dd>
            {m.date_from && m.date_to ? `${m.date_from} — ${m.date_to}` : "—"}
          </dd>
        </div>
      </dl>
      {m.economics_available && (
        <ul className="mt-2 space-y-0.5">
          <li>Referral price: {fmtRub(m.referral_price)}</li>
          <li>Reward: {fmtRub(m.referral_reward)}</li>
          <li>Owner net: {fmtRub(m.referral_owner_net)}</li>
          <li>Guest saves: {fmtRub(m.referral_guest_savings)}</li>
          <li>Owner gain vs aggregator: {fmtRub(m.referral_owner_gain_vs_aggregator)}</li>
        </ul>
      )}
      {m.notes && (
        <p className="mt-2 text-gray-600">
          <span className="font-medium">Заметки:</span> {m.notes}
        </p>
      )}
      {m.rawObject && (
        <pre className="mt-2 max-h-32 overflow-auto rounded border border-gray-200 bg-white p-2 text-[10px]">
          {JSON.stringify(m.rawObject, null, 2)}
        </pre>
      )}
    </details>
  );
}

function auditSummary(entry: AuditLogEntry): string | null {
  if (isPropertyContextSettingsAudit(entry)) {
    return summarizePropertyContextAudit(
      normalizePropertyContextAuditMetadata(entry.metadata),
    );
  }
  if (isManualReferralLeadAudit(entry)) {
    return summarizeManualReferralLeadAudit(
      normalizeManualReferralLeadAuditMetadata(entry.metadata),
    );
  }
  return null;
}

const FILTER_BUTTONS: { id: AuditLogFilter; label: (n: number) => string }[] = [
  { id: "all", label: (n) => `All (${n})` },
  { id: "referral_leads", label: (n) => `Referral leads (${n})` },
  { id: "property_context", label: (n) => `Property context (${n})` },
  { id: "other", label: (n) => `Other (${n})` },
];

export function RevenueAuditLogTable({ auditLog }: { auditLog: AuditLogEntry[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filterFromUrl = useMemo(
    () => parseAuditFilter(searchParams.get("auditFilter")),
    [searchParams],
  );

  const [filter, setFilter] = useState<AuditLogFilter>(filterFromUrl);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    setFilter(filterFromUrl);
  }, [filterFromUrl]);

  useEffect(() => {
    if (!shouldScrollToAuditLogFromSearchParams(searchParams)) return;

    const frame = requestAnimationFrame(() => {
      scrollToAuditLogAnchor();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const applyFilter = useCallback(
    (next: AuditLogFilter) => {
      setFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("auditFilter", auditFilterToUrlValue(next));
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const summary = useMemo(() => buildAuditLogSummary(auditLog), [auditLog]);
  const referralExportRows = useMemo(
    () => buildReferralLeadExportRows(auditLog),
    [auditLog],
  );
  const filtered = useMemo(
    () => filterAuditLogEntries(auditLog, filter),
    [auditLog, filter],
  );

  const exportDisabled = summary.referralLeads === 0;

  const copyReferralCsv = async () => {
    setExportErr(null);
    setExportMsg(null);
    const text = referralLeadRowsToCsv(referralExportRows);
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof window !== "undefined" &&
        window.isSecureContext &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(text);
        setExportMsg("Referral CSV copied.");
        window.setTimeout(() => setExportMsg(null), 2500);
        return;
      }
    } catch {
      /* fallback below */
    }
    setExportErr("Clipboard недоступен");
  };

  const downloadReferralCsv = () => {
    setExportErr(null);
    setExportMsg(null);
    const text = referralLeadRowsToCsv(referralExportRows);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = referralLeadExportFilename();
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg("Referral CSV downloaded.");
    window.setTimeout(() => setExportMsg(null), 2500);
  };

  const copyReferralTsv = async () => {
    setExportErr(null);
    setExportMsg(null);
    const text = referralLeadRowsToTsv(referralExportRows);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(text);
        setExportMsg("Referral TSV copied.");
        window.setTimeout(() => setExportMsg(null), 2500);
        return;
      }
    } catch {
      //
    }
    setExportErr("Clipboard недоступен");
  };

  const countForFilter = (id: AuditLogFilter): number => {
    if (id === "all") return summary.total;
    if (id === "referral_leads") return summary.referralLeads;
    if (id === "property_context") return summary.propertyContextChanges;
    return summary.other;
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Фильтр журнала аудита"
      >
        <span className="text-xs font-semibold text-indigo-900 shrink-0">
          Referral leads: {summary.referralLeads}
        </span>
        <span className="text-gray-300 hidden sm:inline">|</span>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            disabled={exportDisabled}
            onClick={() => void copyReferralCsv()}
            className="px-2 py-1 text-[11px] rounded border border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copy referral CSV
          </button>
          <button
            type="button"
            disabled={exportDisabled}
            onClick={downloadReferralCsv}
            className="px-2 py-1 text-[11px] rounded border border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Download referral CSV
          </button>
          <button
            type="button"
            disabled={exportDisabled}
            onClick={() => void copyReferralTsv()}
            className="px-2 py-1 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copy referral TSV
          </button>
        </div>
        <span className="text-gray-300 hidden sm:inline">|</span>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_BUTTONS.map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyFilter(id)}
                className={
                  "px-2.5 py-1 text-[11px] rounded border font-medium transition-colors " +
                  (active
                    ? "border-indigo-400 bg-indigo-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100")
                }
                aria-pressed={active}
              >
                {label(countForFilter(id))}
              </button>
            );
          })}
        </div>
        {exportMsg && (
          <span className="text-[11px] text-emerald-700 w-full sm:w-auto">{exportMsg}</span>
        )}
        {exportErr && (
          <span className="text-[11px] text-red-600 w-full sm:w-auto">{exportErr}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center rounded-lg border border-dashed border-gray-200 bg-white">
          Нет записей для выбранного фильтра.
        </p>
      ) : (
    <div className="aq-table-wrap">
      <table className="aq-table">
        <thead>
          <tr>
            {["Дата", "Действие", "Статус", "Объект", "Период", "Цена", "Актор"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((entry) => {
            const summary = auditSummary(entry);
            const hasDetails =
              isPropertyContextSettingsAudit(entry) || isManualReferralLeadAudit(entry);

            return (
              <tr key={entry.id} className="align-top">
                <td className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString("ru-RU", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="min-w-[10rem]">
                  <AuditActionBadge entry={entry} />
                  {summary && (
                    <p className="mt-1 text-xs text-gray-700 leading-snug max-w-md">{summary}</p>
                  )}
                  {hasDetails && isPropertyContextSettingsAudit(entry) && (
                    <PcsAuditDetails entry={entry} />
                  )}
                  {hasDetails && isManualReferralLeadAudit(entry) && (
                    <ReferralLeadAuditDetails entry={entry} />
                  )}
                </td>
                <td className="text-xs text-gray-500">
                  {entry.previous_status && entry.new_status
                    ? `${entry.previous_status} → ${entry.new_status}`
                    : entry.new_status ?? "—"}
                </td>
                <td className="font-medium text-gray-800">
                  {entry.apartment_id ? `№${entry.apartment_id}` : "—"}
                </td>
                <td className="text-xs text-gray-600 whitespace-nowrap">
                  {entry.date_from && entry.date_to
                    ? `${entry.date_from} — ${entry.date_to}`
                    : "—"}
                </td>
                <td className="text-right font-medium text-gray-800">
                  {entry.new_price ? `${fmt(entry.new_price)} ₽` : "—"}
                </td>
                <td className="text-xs text-gray-400">{entry.actor ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      )}
    </div>
  );
}
