"use client";

import { useMemo, useState } from "react";
import type { CompetitorSource } from "@/lib/adminApi";

type CohortFilterId =
  | "all"
  | "standard_family_2room"
  | "large_family_house_territory"
  | "gelendzhik_background_market"
  | "excluded_rejected";

const COHORT_LABELS: Record<string, string> = {
  standard_family_2room: "Семейные 2-комн., 4–5 гостей",
  large_family_house_territory: "Крупные 6–8, территория",
  gelendzhik_background_market: "Фоновый рынок",
};

const COHORT_BADGE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  standard_family_2room: { bg: "#DBEAFE", color: "#1D4ED8", border: "#93C5FD" },
  large_family_house_territory: { bg: "#FEF3C7", color: "#B45309", border: "#FCD34D" },
  gelendzhik_background_market: { bg: "#F3F4F6", color: "#4B5563", border: "#D1D5DB" },
};

function cohortBadgeStyle(code: string | null | undefined) {
  if (!code) return { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" };
  return COHORT_BADGE_STYLE[code] ?? { bg: "#F8FAFC", color: "#475569", border: "#E2E8F0" };
}

function cohortLabel(code: string | null | undefined) {
  if (!code) return "Без когорты";
  return COHORT_LABELS[code] ?? code;
}

function fmtRub(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("ru-RU");
}

function fmtTargetApts(ids: number[] | null | undefined) {
  if (!ids?.length) return "—";
  return ids.map((id) => `№${id}`).join(", ");
}

function isExcludedRejected(s: CompetitorSource): boolean {
  const st = String(s.status ?? "").toLowerCase();
  const ds = String(s.discovery_status ?? "").toLowerCase();
  return st === "excluded" || st === "rejected" || ds === "rejected";
}

function matchesFilter(s: CompetitorSource, tab: CohortFilterId): boolean {
  switch (tab) {
    case "all":
      return true;
    case "standard_family_2room":
      return s.cohort_code === "standard_family_2room";
    case "large_family_house_territory":
      return s.cohort_code === "large_family_house_territory";
    case "gelendzhik_background_market":
      return s.cohort_code === "gelendzhik_background_market";
    case "excluded_rejected":
      return isExcludedRejected(s);
    default:
      return true;
  }
}

function SimilarityBadge({ score }: { score: number }) {
  const style =
    score >= 90 ? { bg: "#D1FAE5", color: "#065F46" } :
    score >= 80 ? { bg: "#FEF3C7", color: "#92400E" } :
                  { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {score}%
    </span>
  );
}

function CohortBadge({ code }: { code: string | null | undefined }) {
  const st = cohortBadgeStyle(code);
  const label = cohortLabel(code);
  return (
    <span
      className="inline-flex items-center max-w-[200px] px-2 py-0.5 rounded-md text-[11px] font-medium leading-tight border"
      style={{
        background: st.bg,
        color: st.color,
        borderColor: st.border,
      }}
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function CompetitorSourcesTable({ rows }: { rows: CompetitorSource[] }) {
  const [tab, setTab] = useState<CohortFilterId>("all");

  const counts = useMemo(() => {
    const n = rows.length;
    const standard_family_2room = rows.filter((s) => s.cohort_code === "standard_family_2room").length;
    const large_family_house_territory = rows.filter(
      (s) => s.cohort_code === "large_family_house_territory",
    ).length;
    const gelendzhik_background_market = rows.filter(
      (s) => s.cohort_code === "gelendzhik_background_market",
    ).length;
    const excluded_rejected = rows.filter(isExcludedRejected).length;
    return {
      all: n,
      standard_family_2room,
      large_family_house_territory,
      gelendzhik_background_market,
      excluded_rejected,
    };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((s) => matchesFilter(s, tab)), [rows, tab]);

  const tabs: { id: CohortFilterId; label: string; count: number; hideWhenZero?: boolean }[] = [
    { id: "all", label: "Все", count: counts.all },
    {
      id: "standard_family_2room",
      label: "№40/41/42 — семейные 2-комнатные",
      count: counts.standard_family_2room,
    },
    {
      id: "large_family_house_territory",
      label: "№50 — крупные семейные объекты",
      count: counts.large_family_house_territory,
    },
    {
      id: "gelendzhik_background_market",
      label: "Фоновый рынок",
      count: counts.gelendzhik_background_market,
    },
    {
      id: "excluded_rejected",
      label: "Исключённые / отклонённые",
      count: counts.excluded_rejected,
      hideWhenZero: true,
    },
  ];

  const visibleTabs = tabs.filter((t) => !(t.hideWhenZero && t.count === 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-[#0B63CE] bg-[#EAF7FF] text-[#072B55]"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0 text-[10px] ${
                  active ? "bg-white/80 text-[#0B63CE]" : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl border px-5 py-4 text-sm"
          style={{ background: "#F8FBFF", borderColor: "#D9E7F5", color: "#64748B" }}
        >
          В этой когорте пока нет конкурентов.
        </div>
      ) : (
        <div className="aq-table-wrap">
          <table className="aq-table">
            <thead>
              <tr>
                {[
                  "Название",
                  "Когорта",
                  "Объекты",
                  "Сходство",
                  "Сигнал",
                  "Статусы",
                  "Цена min–max",
                  "Посл. цена",
                  "Наблюдение",
                  "Платформа",
                  "Ссылка",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const latestAt = s.latest_observed_at ?? s.last_observed_at;
                const low = s.price_low;
                const high = s.price_high;
                const range =
                  low != null && high != null
                    ? `${fmtRub(low)} – ${fmtRub(high)}`
                    : low != null
                      ? `${fmtRub(low)}`
                      : high != null
                        ? `${fmtRub(high)}`
                        : "—";
                const sig = s.signal_quality_score;
                const sigNum = sig != null ? Number(sig) : null;
                return (
                  <tr key={s.id}>
                    <td className="font-medium text-gray-900 max-w-[220px]">{s.name}</td>
                    <td className="align-top whitespace-nowrap py-2">
                      <CohortBadge code={s.cohort_code} />
                    </td>
                    <td className="text-xs text-gray-600 whitespace-nowrap">
                      {fmtTargetApts(s.target_apartment_ids ?? undefined)}
                    </td>
                    <td className="text-center">
                      <SimilarityBadge score={s.similarity_score} />
                    </td>
                    <td className="text-center text-xs text-gray-600">
                      {sigNum != null && !Number.isNaN(sigNum) ? `${Math.round(sigNum * 100)}%` : "—"}
                    </td>
                    <td className="text-xs text-gray-600 whitespace-nowrap">
                      {s.discovery_status ?? "—"}
                      <span className="text-gray-400"> / </span>
                      {s.status}
                    </td>
                    <td className="text-right text-xs text-gray-700 whitespace-nowrap">{range}</td>
                    <td className="text-right font-semibold text-gray-900">
                      {s.latest_price != null ? s.latest_price.toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {latestAt
                        ? new Date(latestAt).toLocaleString("ru-RU", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="text-xs text-gray-500">{s.source_platform}</td>
                    <td>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs whitespace-nowrap"
                        >
                          открыть
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
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
