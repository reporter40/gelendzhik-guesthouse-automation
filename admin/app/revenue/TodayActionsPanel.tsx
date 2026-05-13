"use client";

import { RevenueDashboardData, TodayAction, TodayActionPriority } from "@/lib/adminApi";

function fmtRub(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

const PRIORITY_CONFIG: Record<TodayActionPriority, { label: string; badgeClass: string; cardClass: string; dotClass: string }> = {
  high: {
    label: "Срочно",
    badgeClass: "bg-red-100 text-red-700 ring-1 ring-red-200",
    cardClass: "border-red-200 bg-red-50/40",
    dotClass: "bg-red-500",
  },
  medium: {
    label: "Важно",
    badgeClass: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
    cardClass: "border-amber-200 bg-amber-50/40",
    dotClass: "bg-amber-500",
  },
  low: {
    label: "Можно позже",
    badgeClass: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
    cardClass: "border-blue-100 bg-blue-50/20",
    dotClass: "bg-blue-400",
  },
};

const TYPE_ICON: Record<string, string> = {
  gap: "🪟",
  approve: "✅",
  export: "📋",
  market: "📊",
  failed: "⚠️",
  info: "✨",
};

function ActionCard({ action }: { action: TodayAction }) {
  const cfg = PRIORITY_CONFIG[action.priority];
  const icon = TYPE_ICON[action.type] ?? "•";

  const handleCta = () => {
    const el = document.querySelector(action.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className={`relative rounded-xl border p-4 flex flex-col gap-3 ${cfg.cardClass} transition-shadow hover:shadow-md`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">{action.title}</h3>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{action.description}</p>

      {/* Amount */}
      {action.amount != null && action.amount > 0 && (
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-1 bg-white/70 border border-gray-200 rounded-lg px-2.5 py-1 text-sm font-bold text-gray-800">
            {fmtRub(action.amount)}
          </span>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleCta}
        className="mt-auto w-full rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm font-medium text-indigo-700 px-3 py-2 transition-colors text-center"
      >
        {action.cta_label} →
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 text-center">
      <div className="text-3xl mb-2">✅</div>
      <p className="text-sm font-semibold text-green-800">Срочных действий нет</p>
      <p className="text-sm text-green-600 mt-1">
        Система в норме. Проверьте свежесть данных конкурентов при случае.
      </p>
    </div>
  );
}

export function TodayActionsPanel({ data }: { data: RevenueDashboardData | null }) {
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <p className="text-sm text-gray-400 text-center">Загрузка плана действий…</p>
      </div>
    );
  }

  const actions = data.today_actions ?? [];
  const highActions = actions.filter((a) => a.priority === "high");
  const mediumActions = actions.filter((a) => a.priority === "medium");
  const lowActions = actions.filter((a) => a.priority === "low");

  const allGood = actions.length === 0 || (highActions.length === 0 && mediumActions.length === 0);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700">
        <h2 className="text-lg font-bold text-white">Что сделать сегодня</h2>
        <p className="text-sm text-indigo-200 mt-0.5">
          Короткий список действий, которые помогают не терять деньги
        </p>
      </div>

      <div className="p-6">
        {allGood && actions.every((a) => a.type === "info") ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {/* HIGH */}
            {highActions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
                  🔴 Срочно
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {highActions.map((a) => (
                    <ActionCard key={a.id} action={a} />
                  ))}
                </div>
              </div>
            )}

            {/* MEDIUM */}
            {mediumActions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">
                  🟡 Важно
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mediumActions.map((a) => (
                    <ActionCard key={a.id} action={a} />
                  ))}
                </div>
              </div>
            )}

            {/* LOW */}
            {lowActions.length > 0 && lowActions[0]?.type !== "info" && (
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                  🔵 Можно позже
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lowActions.filter((a) => a.type !== "info").map((a) => (
                    <ActionCard key={a.id} action={a} />
                  ))}
                </div>
              </div>
            )}

            {/* All good info card */}
            {actions.length === 1 && actions[0].type === "info" && <EmptyState />}
          </div>
        )}

        {/* Summary footer */}
        {data.summary && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
            <span>Окон: <b className="text-gray-600">{data.summary.total_gaps}</b></span>
            <span>Потеря: <b className="text-gray-600">{Math.round(data.summary.total_estimated_loss).toLocaleString("ru-RU")} ₽</b></span>
            <span>Draft: <b className="text-gray-600">{data.summary.draft_recommendations}</b></span>
            <span>Экспортировано: <b className="text-gray-600">{data.summary.exported_recommendations}</b></span>
            <span>Конкуренты: <b className="text-gray-600">{data.summary.active_competitors}</b></span>
            {data.summary.market_median != null && (
              <span>Медиана рынка: <b className="text-gray-600">{Math.round(data.summary.market_median).toLocaleString("ru-RU")} ₽/сут</b></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
