"use client";

import { RevenueDashboardData, TodayAction, TodayActionPriority } from "@/lib/adminApi";

function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

type PriorityCfg = {
  label: string;
  badgeBg: string;
  badgeColor: string;
  cardBg: string;
  cardBorder: string;
  sectionLabel: string;
  dot: string;
};

const PRIORITY_CONFIG: Record<TodayActionPriority, PriorityCfg> = {
  high: {
    label: "Срочно",
    badgeBg: "#FEE2E2",
    badgeColor: "#B91C1C",
    cardBg: "#FFF8F8",
    cardBorder: "#FECACA",
    sectionLabel: "🔴 Срочно",
    dot: "#EF4444",
  },
  medium: {
    label: "Важно",
    badgeBg: "#FEF3C7",
    badgeColor: "#92400E",
    cardBg: "#FFFDF5",
    cardBorder: "#FDE68A",
    sectionLabel: "🟡 Важно",
    dot: "#F59E0B",
  },
  low: {
    label: "Можно позже",
    badgeBg: "#EAF7FF",
    badgeColor: "#0B63CE",
    cardBg: "#F8FBFF",
    cardBorder: "#BEE3F8",
    sectionLabel: "🔵 Можно позже",
    dot: "#3B82F6",
  },
};

const TYPE_ICON: Record<string, string> = {
  gap:     "🪟",
  approve: "✅",
  export:  "📋",
  market:  "📊",
  failed:  "⚠️",
  info:    "✨",
};

function ActionCard({ action }: { action: TodayAction }) {
  const cfg = PRIORITY_CONFIG[action.priority];
  const icon = TYPE_ICON[action.type] ?? "•";

  const handleCta = () => {
    const el = document.querySelector(action.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="relative rounded-2xl flex flex-col gap-3 transition-all hover:shadow-md"
      style={{
        background: cfg.cardBg,
        border: `1px solid ${cfg.cardBorder}`,
        padding: "16px",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{icon}</span>
          <h3 className="text-sm font-semibold leading-tight" style={{ color: "#072B55" }}>
            {action.title}
          </h3>
        </div>
        <span
          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>{action.description}</p>

      {/* Amount */}
      {action.amount != null && action.amount > 0 && (
        <div>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold"
            style={{ background: "#fff", border: "1px solid #E2E8F0", color: "#0F172A" }}
          >
            {fmtRub(action.amount)}
          </span>
        </div>
      )}

      {/* CTA button */}
      <button
        onClick={handleCta}
        className="mt-auto w-full rounded-lg text-sm font-medium px-3 py-2 transition-colors text-center"
        style={{
          background: "#fff",
          border: "1px solid #D9E7F5",
          color: "#0B63CE",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#EAF7FF";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#20C6D7";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#fff";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#D9E7F5";
        }}
      >
        {action.cta_label} →
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl px-6 py-6 text-center"
      style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
    >
      <div className="text-3xl mb-2">✅</div>
      <p className="text-sm font-semibold" style={{ color: "#065F46" }}>Срочных действий нет</p>
      <p className="text-sm mt-1" style={{ color: "#047857" }}>
        Система в норме. Проверьте свежесть данных конкурентов при случае.
      </p>
    </div>
  );
}

export function TodayActionsPanel({ data }: { data: RevenueDashboardData | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border px-6 py-5"
           style={{ background: "#F8FBFF", borderColor: "#D9E7F5" }}>
        <p className="text-sm text-center" style={{ color: "#94A3B8" }}>Загрузка плана действий…</p>
      </div>
    );
  }

  const actions = data.today_actions ?? [];
  const highActions   = actions.filter((a) => a.priority === "high");
  const mediumActions = actions.filter((a) => a.priority === "medium");
  const lowActions    = actions.filter((a) => a.priority === "low");

  const allGood = actions.length === 0 || (highActions.length === 0 && mediumActions.length === 0);

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ border: "1px solid #D9E7F5", background: "#fff" }}
    >
      {/* Panel header */}
      <div
        className="px-7 py-5"
        style={{ background: "linear-gradient(135deg, #072B55 0%, #0B63CE 100%)" }}
      >
        <h2 className="text-lg font-bold text-white">Что сделать сегодня</h2>
        <p className="text-sm mt-0.5" style={{ color: "#93C5FD" }}>
          Короткий список действий, которые помогают не терять деньги
        </p>
      </div>

      <div className="p-6">
        {allGood && actions.every((a) => a.type === "info") ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {highActions.length > 0 && (
              <PriorityGroup label="🔴 Срочно" labelColor="#DC2626" actions={highActions} />
            )}
            {mediumActions.length > 0 && (
              <PriorityGroup label="🟡 Важно" labelColor="#D97706" actions={mediumActions} />
            )}
            {lowActions.length > 0 && lowActions[0]?.type !== "info" && (
              <PriorityGroup
                label="🔵 Можно позже"
                labelColor="#2563EB"
                actions={lowActions.filter((a) => a.type !== "info")}
              />
            )}
            {actions.length === 1 && actions[0].type === "info" && <EmptyState />}
          </div>
        )}

        {/* Summary footer */}
        {data.summary && (
          <div
            className="mt-5 pt-4 flex flex-wrap gap-4 text-xs"
            style={{ borderTop: "1px solid #EAF7FF", color: "#94A3B8" }}
          >
            <span>Окон: <b className="text-gray-600">{data.summary.total_gaps}</b></span>
            <span>Потеря: <b className="text-gray-600">{Math.round(data.summary.total_estimated_loss).toLocaleString("ru-RU")} ₽</b></span>
            <span>Draft: <b className="text-gray-600">{data.summary.draft_recommendations}</b></span>
            <span>Экспортировано: <b className="text-gray-600">{data.summary.exported_recommendations}</b></span>
            <span>Конкуренты: <b className="text-gray-600">{data.summary.active_competitors}</b></span>
            {data.summary.market_median != null && (
              <span>Медиана: <b className="text-gray-600">{Math.round(data.summary.market_median).toLocaleString("ru-RU")} ₽/сут</b></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityGroup({
  label, labelColor, actions,
}: {
  label: string;
  labelColor: string;
  actions: TodayAction[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: labelColor }}>
        {label}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </div>
    </div>
  );
}
