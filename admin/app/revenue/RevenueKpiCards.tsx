import { RevenueDashboardSummary, RevenueSummary } from "@/lib/adminApi";

function fmtNum(n: number | null | undefined, fallback = "—"): string {
  if (n == null || isNaN(n as number)) return fallback;
  return (n as number).toLocaleString("ru-RU");
}

type Accent = "normal" | "warning" | "danger" | "success" | "info";

type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
  icon?: string;
};

const ACCENT_STYLES: Record<Accent, { bg: string; border: string; valueColor: string; subColor: string }> = {
  normal:  { bg: "#FFFFFF",  border: "#D9E7F5", valueColor: "#072B55", subColor: "#94A3B8" },
  warning: { bg: "#FFFDF5",  border: "#FDE68A", valueColor: "#92400E", subColor: "#B45309" },
  danger:  { bg: "#FFF8F8",  border: "#FECACA", valueColor: "#B91C1C", subColor: "#DC2626" },
  success: { bg: "#F0FDF4",  border: "#BBF7D0", valueColor: "#065F46", subColor: "#047857" },
  info:    { bg: "#EAF7FF",  border: "#BEE3F8", valueColor: "#0B63CE", subColor: "#3B82F6" },
};

function KpiCard({ label, value, sub, accent = "normal", icon }: KpiCardProps) {
  const s = ACCENT_STYLES[accent];
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1.5 transition-shadow hover:shadow-md"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs font-medium leading-tight" style={{ color: "#64748B" }}>{label}</p>
        {icon && <span className="text-base leading-none opacity-70">{icon}</span>}
      </div>
      <p className="text-2xl font-bold leading-tight" style={{ color: s.valueColor }}>{value}</p>
      {sub && <p className="text-xs leading-tight" style={{ color: s.subColor }}>{sub}</p>}
    </div>
  );
}

type Props = {
  dashboard: RevenueDashboardSummary | null | undefined;
  legacy?: RevenueSummary | null;
};

export function RevenueKpiCards({ dashboard, legacy }: Props) {
  const totalGaps    = dashboard?.total_gaps          ?? legacy?.total_gaps          ?? 0;
  const totalLoss    = dashboard?.total_estimated_loss ?? legacy?.total_estimated_loss ?? 0;
  const marketMedian = dashboard?.market_median       ?? legacy?.market_median       ?? legacy?.latest_market_median_from_sources ?? null;
  const activeComp   = dashboard?.active_competitors  ?? legacy?.active_competitors_count ?? legacy?.competitor_count ?? 0;

  const draftRecs    = dashboard?.draft_recommendations     ?? 0;
  const approvedRecs = dashboard?.approved_recommendations  ?? 0;
  const exportedRecs = dashboard?.exported_recommendations  ?? 0;
  const failedRecs   = dashboard?.apply_failed_recommendations ?? 0;

  const waitingDecision = draftRecs + approvedRecs;

  const cards: KpiCardProps[] = [
    {
      icon: "💸",
      label: "Потенциальная потеря",
      value: totalLoss > 0 ? `${fmtNum(Math.round(totalLoss))} ₽` : "0 ₽",
      sub: totalLoss > 0 ? "из маленьких окон" : "окон нет — всё ок",
      accent: totalLoss > 0 ? "danger" : "success",
    },
    {
      icon: "🪟",
      label: "Маленьких окон",
      value: String(totalGaps),
      sub: totalGaps === 0 ? "нет — отлично" : `${totalGaps === 1 ? "1 окно" : totalGaps < 5 ? `${totalGaps} окна` : `${totalGaps} окон`}`,
      accent: totalGaps > 0 ? "warning" : "success",
    },
    {
      icon: "📊",
      label: "Медиана рынка",
      value: marketMedian != null ? `${fmtNum(Math.round(marketMedian))} ₽` : "—",
      sub: marketMedian != null ? "₽/сут, конкуренты" : "нет данных",
      accent: marketMedian != null ? "info" : "normal",
    },
    {
      icon: "⏳",
      label: "Ждут решения",
      value: String(waitingDecision),
      sub: waitingDecision > 0
        ? `${draftRecs} draft + ${approvedRecs} одобрено`
        : "нет ожидающих",
      accent: waitingDecision > 0 ? "warning" : "normal",
    },
    {
      icon: "📋",
      label: "К ручному применению",
      value: String(exportedRecs),
      sub: exportedRecs > 0 ? "перенести в RealtyCalendar" : "нечего переносить",
      accent: exportedRecs > 0 ? "warning" : "normal",
    },
    {
      icon: "⚠️",
      label: "Ошибки применения",
      value: String(failedRecs),
      sub: failedRecs > 0 ? "требуют проверки" : "всё в порядке",
      accent: failedRecs > 0 ? "danger" : "success",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}
