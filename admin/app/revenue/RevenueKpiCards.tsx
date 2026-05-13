import { RevenueDashboardSummary, RevenueSummary } from "@/lib/adminApi";

function fmtNum(n: number | null | undefined, fallback = "—"): string {
  if (n == null || isNaN(n as number)) return fallback;
  return (n as number).toLocaleString("ru-RU");
}

type KpiCard = {
  label: string;
  value: string;
  sub?: string;
  accent?: "normal" | "warning" | "danger" | "success";
};

function KpiCard({ label, value, sub, accent = "normal" }: KpiCard) {
  const accentMap = {
    normal:  "border-gray-200 bg-white",
    warning: "border-amber-200 bg-amber-50",
    danger:  "border-red-200 bg-red-50",
    success: "border-green-200 bg-green-50",
  };
  const textMap = {
    normal:  "text-gray-900",
    warning: "text-amber-700",
    danger:  "text-red-700",
    success: "text-green-700",
  };
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${accentMap[accent]}`}>
      <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${textMap[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 leading-tight">{sub}</p>}
    </div>
  );
}

type Props = {
  dashboard: RevenueDashboardSummary | null | undefined;
  legacy?: RevenueSummary | null;
};

export function RevenueKpiCards({ dashboard, legacy }: Props) {
  // Prefer dashboard data, fall back to legacy revenue summary
  const totalGaps     = dashboard?.total_gaps         ?? legacy?.total_gaps         ?? 0;
  const totalLoss     = dashboard?.total_estimated_loss ?? legacy?.total_estimated_loss ?? 0;
  const marketMedian  = dashboard?.market_median      ?? legacy?.market_median      ?? legacy?.latest_market_median_from_sources ?? null;
  const activeComp    = dashboard?.active_competitors ?? legacy?.active_competitors_count ?? legacy?.competitor_count ?? 0;

  const draftRecs     = dashboard?.draft_recommendations     ?? 0;
  const approvedRecs  = dashboard?.approved_recommendations  ?? 0;
  const exportedRecs  = dashboard?.exported_recommendations  ?? 0;
  const failedRecs    = dashboard?.apply_failed_recommendations ?? 0;

  const waitingDecision = draftRecs + approvedRecs;

  const cards: KpiCard[] = [
    {
      label: "Потенциальная потеря",
      value: totalLoss > 0 ? `${fmtNum(Math.round(totalLoss))} ₽` : "0 ₽",
      sub: totalLoss > 0 ? "из маленьких окон" : "окон нет",
      accent: totalLoss > 0 ? "danger" : "normal",
    },
    {
      label: "Маленьких окон",
      value: String(totalGaps),
      sub: totalGaps === 0 ? "всё занято" : `${totalGaps} ${totalGaps === 1 ? "окно" : totalGaps < 5 ? "окна" : "окон"}`,
      accent: totalGaps > 0 ? "warning" : "success",
    },
    {
      label: "Медиана рынка",
      value: marketMedian != null ? `${fmtNum(Math.round(marketMedian))} ₽` : "—",
      sub: marketMedian != null ? "₽/сут, прямые конкуренты" : "нет данных",
      accent: "normal",
    },
    {
      label: "Ждут решения",
      value: String(waitingDecision),
      sub: waitingDecision > 0
        ? `${draftRecs} draft + ${approvedRecs} одобрено`
        : "нет ожидающих",
      accent: waitingDecision > 0 ? "warning" : "normal",
    },
    {
      label: "Готово к ручному применению",
      value: String(exportedRecs),
      sub: exportedRecs > 0 ? "перенести в RealtyCalendar" : "нечего переносить",
      accent: exportedRecs > 0 ? "warning" : "normal",
    },
    {
      label: "Ошибки применения",
      value: String(failedRecs),
      sub: failedRecs > 0 ? "требуют проверки" : "всё в порядке",
      accent: failedRecs > 0 ? "danger" : "success",
    },
  ];

  // If no dashboard data — show minimal legacy cards
  if (!dashboard && legacy) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.slice(0, 6).map((c) => (
          <KpiCard key={c.label} {...c} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}
