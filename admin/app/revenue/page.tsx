import { requireAuth } from "@/lib/session";
import {
  adminApi,
  fetchAuditLog,
  fetchMarketHistory,
  fetchRevenueDashboard,
  fetchRevenueNotificationsStatus,
  AdminApiError,
  RevenueData,
  CompetitorPriceObservation,
  AuditLogEntry,
  MarketHistoryData,
  RevenueDashboardData,
  RevenueNotificationsStatus,
} from "@/lib/adminApi";
import Nav from "@/components/Nav";
import CompetitorForm from "./CompetitorForm";
import { ApprovalsPanel } from "./ApprovalsPanel";
import { MarketHistoryPanel } from "./MarketHistoryPanel";
import { ManualObservationForm } from "./ManualObservationForm";
import { TodayActionsPanel } from "./TodayActionsPanel";
import { RevenueKpiCards } from "./RevenueKpiCards";
import { RevenueNotificationsPanel } from "./RevenueNotificationsPanel";

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n)) return fallback;
  return n.toLocaleString("ru-RU");
}

export default async function RevenuePage() {
  await requireAuth();

  let data: RevenueData | null = null;
  let error: string | null = null;
  let auditLog: AuditLogEntry[] = [];
  let marketHistory: MarketHistoryData | null = null;
  let dashboard: RevenueDashboardData | null = null;
  let notificationsStatus: RevenueNotificationsStatus | null = null;
  let notificationsError: string | null = null;

  try {
    [data, auditLog, marketHistory, dashboard] = await Promise.all([
      adminApi("revenue"),
      fetchAuditLog().catch(() => []),
      fetchMarketHistory().catch(() => null),
      fetchRevenueDashboard().catch(() => null),
    ]);
  } catch (e) {
    error = e instanceof AdminApiError ? e.message : "Ошибка загрузки данных";
  }

  try {
    notificationsStatus = await fetchRevenueNotificationsStatus();
  } catch (e) {
    notificationsError = e instanceof AdminApiError ? e.message : "Ошибка загрузки статуса уведомлений";
  }

  const summary           = data?.summary;
  const gaps              = data?.gap_windows             ?? [];
  const comps             = data?.competitor_prices       ?? [];
  const recs              = data?.pricing_recommendations ?? [];
  const sources           = data?.latest_observations     ?? [];
  const competitorSources = data?.competitor_sources      ?? [];

  const apiOk = !error && (data != null || dashboard != null);

  return (
    <>
      <Nav />

      <main
        className="mx-auto px-6 pb-16"
        style={{ maxWidth: 1440, paddingTop: 32 }}
      >
        {/* ── Page Hero ── */}
        <div
          className="rounded-2xl px-8 py-6 mb-8 flex items-start justify-between gap-4 flex-wrap"
          style={{
            background: "linear-gradient(135deg, #072B55 0%, #0B5EA8 60%, #20C6D7 130%)",
          }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Revenue Intelligence
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              Контроль маленьких окон, рынка и рекомендаций по цене
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start mt-0.5">
            {apiOk ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                API работает
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                API недоступен
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ── 1. TODAY ACTIONS ── */}
        <TodayActionsPanel data={dashboard} />

        {/* ── 2. NOTIFICATIONS STATUS ── */}
        <div className="mt-6">
          <RevenueNotificationsPanel data={notificationsStatus} error={notificationsError} />
        </div>

        {/* ── 3. KPI cards ── */}
        <div className="mt-6">
          <RevenueKpiCards dashboard={dashboard?.summary} legacy={summary} />
        </div>

        {/* ── 3. Market mini-summary ── */}
        {summary && (summary.latest_market_min_from_sources || summary.market_min) && (
          <div
            className="mt-6 rounded-2xl border px-6 py-4 flex flex-wrap gap-6"
            style={{ background: "#EAF7FF", borderColor: "#BEE3F8" }}
          >
            <p className="w-full text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#0B63CE" }}>
              Рыночные цены прямых конкурентов
            </p>
            <Stat label="Минимум"  value={fmt(summary.latest_market_min_from_sources    ?? summary.market_min, "нет данных")} />
            <Stat label="Медиана"  value={fmt(summary.latest_market_median_from_sources ?? summary.market_median, "нет данных")} />
            <Stat label="Среднее"  value={fmt(summary.latest_market_avg_from_sources    ?? summary.market_avg, "нет данных")} />
            <Stat label="Максимум" value={fmt(summary.latest_market_max_from_sources    ?? summary.market_max, "нет данных")} />
            {summary.excluded_competitors_count != null && (
              <p className="w-full text-xs mt-1" style={{ color: "#4A9EC4" }}>
                Активных источников: {summary.active_competitors_count ?? "?"} / Исключено: {summary.excluded_competitors_count}
              </p>
            )}
          </div>
        )}

        {/* ── 4. Gap Windows ── */}
        <Section
          id="gaps"
          title="Маленькие окна между бронями"
          sub="Периоды 1–3 ночи, которые сложно продать по полной цене — стоит предложить скидку"
        >
          {gaps.length === 0 ? (
            <EmptyCard icon="✅" text="Маленьких окон сейчас не найдено. Бронирования стоят плотно." />
          ) : (
            <div className="aq-table-wrap">
              <table className="aq-table">
                <thead>
                  <tr>
                    {["Номер", "Окно", "Ночей", "Потери ₽", "Рекомендация"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g, i) => (
                    <tr key={i}>
                      <td className="font-semibold" style={{ color: "#072B55" }}>№{g.apartment_id}</td>
                      <td className="whitespace-nowrap text-gray-600">{g.gap_start} — {g.gap_end}</td>
                      <td className="text-center">
                        <NightsBadge n={g.nights} />
                      </td>
                      <td className="text-right font-medium text-gray-800">{fmt(g.estimated_loss)}</td>
                      <td className="text-gray-600 max-w-xs text-xs leading-relaxed">{g.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── 5. Pricing Recommendations + Approvals ── */}
        <Section
          id="recommendations"
          title="Ценовые рекомендации"
          sub="Одобрите, отклоните или экспортируйте каждую рекомендацию"
        >
          {recs.length === 0 ? (
            <EmptyCard icon="📝" text="Рекомендаций пока нет. Запустите пересчёт после обновления данных рынка." />
          ) : (
            <ApprovalsPanel recs={recs} auditLog={auditLog} />
          )}
        </Section>

        {/* ── 6. Audit log ── */}
        <Section
          id="audit-log"
          title="Экспорт и аудит действий"
          sub="История одобрений, экспортов и ошибок применения"
        >
          <span id="manual-export" className="scroll-mt-4" />
          {auditLog.length === 0 ? (
            <EmptyCard icon="📋" text="Лог пуст — действий ещё не было." />
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
                  {auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td>
                        <ActionBadge action={entry.action} />
                      </td>
                      <td className="text-xs text-gray-500">
                        {entry.previous_status && entry.new_status
                          ? `${entry.previous_status} → ${entry.new_status}`
                          : entry.new_status ?? "—"}
                      </td>
                      <td className="font-medium text-gray-800">{entry.apartment_id ? `№${entry.apartment_id}` : "—"}</td>
                      <td className="text-xs text-gray-600 whitespace-nowrap">
                        {entry.date_from && entry.date_to ? `${entry.date_from} — ${entry.date_to}` : "—"}
                      </td>
                      <td className="text-right font-medium text-gray-800">
                        {entry.new_price ? `${fmt(entry.new_price)} ₽` : "—"}
                      </td>
                      <td className="text-xs text-gray-400">{entry.actor ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── 7. Competitors ── */}
        <Section
          id="competitors"
          title="Прямые конкуренты"
          sub="Последние наблюдения за ценами. Устаревшие (>14 дней) отмечены ⚠️"
        >
          {sources.length > 0 ? (
            <ObservationsTable observations={sources} />
          ) : (
            <EmptyCard icon="🔍" text="Данных наблюдений нет. Добавьте первое наблюдение ниже." />
          )}
          <div className="mt-5">
            <ManualObservationForm sources={competitorSources} />
          </div>
          <div className="mt-3">
            <button disabled className="aq-btn aq-btn-ghost opacity-40 cursor-not-allowed text-xs">
              Авто-проверка цены (C3 full) — скоро
            </button>
          </div>
        </Section>

        {/* ── 8. Market history ── */}
        <Section id="market-history" title="История рынка" sub="">
          {marketHistory ? (
            <MarketHistoryPanel data={marketHistory} />
          ) : (
            <EmptyCard icon="📈" text="Данных истории рынка нет." />
          )}
        </Section>

        {/* ── 9. Criteria ── */}
        <Section title="Критерии отбора конкурентов" sub="">
          <SelectionCriteria />
        </Section>

        {/* ── 10. Add competitor manually ── */}
        <Section title="Добавить цену конкурента вручную" sub="">
          <CompetitorForm />
          {comps.length > 0 && (
            <div className="mt-5 aq-table-wrap">
              <table className="aq-table">
                <thead>
                  <tr>
                    {["Источник", "Объект", "Период", "₽/ночь", "Рейтинг", "Отзывы"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comps.map((c, i) => (
                    <tr key={i}>
                      <td className="text-gray-600">{c.source}</td>
                      <td className="font-medium text-gray-900">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:underline">{c.title}</a>
                        ) : c.title}
                      </td>
                      <td className="whitespace-nowrap text-gray-600">{c.date_from} — {c.date_to}</td>
                      <td className="text-right font-semibold text-gray-900">{fmt(c.price_per_night)}</td>
                      <td className="text-center text-gray-600">{c.rating ?? "—"}</td>
                      <td className="text-center text-gray-600">{c.reviews_count ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </main>
    </>
  );
}

/* ─── Layout Helpers ──────────────────────────────────────── */

function Section({
  id, title, sub, children,
}: {
  id?: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="aq-section scroll-mt-4">
      <h2 className="aq-section-title">{title}</h2>
      {sub && <p className="aq-section-sub">{sub}</p>}
      {children}
    </section>
  );
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-xl border px-5 py-4 text-sm flex items-center gap-3"
         style={{ background: "#F8FBFF", borderColor: "#D9E7F5", color: "#64748B" }}>
      <span className="text-lg shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function NightsBadge({ n }: { n: number }) {
  const colors =
    n === 1 ? { bg: "#FEE2E2", color: "#B91C1C" } :
    n === 2 ? { bg: "#FEF3C7", color: "#B45309" } :
              { bg: "#DBEAFE", color: "#1D4ED8" };
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
          style={colors}>{n}</span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors =
    action.includes("fail")    ? { bg: "#FEE2E2", color: "#B91C1C" } :
    action.includes("applied") ? { bg: "#D1FAE5", color: "#065F46" } :
    action.includes("export")  ? { bg: "#FEF3C7", color: "#92400E" } :
    action.includes("approv")  ? { bg: "#EDE9FE", color: "#5B21B6" } :
                                 { bg: "#F3F4F6", color: "#4B5563" };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
          style={colors}>{action}</span>
  );
}

function ObservationsTable({ observations }: { observations: CompetitorPriceObservation[] }) {
  return (
    <div className="aq-table-wrap">
      <table className="aq-table">
        <thead>
          <tr>
            {["Конкурент", "Сходство", "Период", "₽/ночь", "Уверенность", "Метод", "Дата"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {observations.map((o, i) => {
            const isStale = o.observed_at && (Date.now() - new Date(o.observed_at).getTime()) > 14 * 86400000;
            const isSeed = o.collection_method === "seed_from_pdf_report";
            return (
              <tr key={i}>
                <td className="font-medium text-gray-900">
                  <a href={o.competitor_url} target="_blank" rel="noopener noreferrer"
                     className="text-blue-600 hover:underline">{o.competitor_name}</a>
                </td>
                <td className="text-center">
                  <SimilarityBadge score={o.similarity_score} />
                </td>
                <td className="text-gray-600 whitespace-nowrap text-xs">{o.stay_date_from} — {o.stay_date_to}</td>
                <td className="text-right font-semibold text-gray-900">
                  {o.price_per_night ? o.price_per_night.toLocaleString("ru-RU") : "—"}
                </td>
                <td className="text-center text-gray-500 text-xs">
                  {o.confidence != null ? `${Math.round(o.confidence * 100)}%` : "—"}
                </td>
                <td>
                  <span className="inline-flex px-2 py-0.5 rounded text-xs"
                        style={{ background: isSeed ? "#FEF3C7" : "#F1F5F9", color: isSeed ? "#92400E" : "#475569" }}>
                    {isSeed ? "seed/PDF" : o.collection_method}
                  </span>
                  {(isStale || isSeed) && (
                    <span className="ml-1 text-amber-500 text-xs" title="Данные устарели или seed">⚠️</span>
                  )}
                </td>
                <td className="text-gray-400 text-xs whitespace-nowrap">
                  {o.observed_at ? new Date(o.observed_at).toLocaleDateString("ru-RU") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SimilarityBadge({ score }: { score: number }) {
  const style =
    score >= 90 ? { bg: "#D1FAE5", color: "#065F46" } :
    score >= 80 ? { bg: "#FEF3C7", color: "#92400E" } :
                  { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
          style={{ background: style.bg, color: style.color }}>{score}%</span>
  );
}

function SelectionCriteria() {
  const criteria = [
    { icon: "📍", label: "Район",       value: "Толстый мыс / центр, Геленджик" },
    { icon: "🏖️", label: "Пляж",        value: "≤ 700 м (5–7 мин пешком)" },
    { icon: "📐", label: "Площадь",     value: "30–55 м²" },
    { icon: "👨‍👩‍👧", label: "Вместимость", value: "4–6 гостей" },
    { icon: "🍳", label: "Кухня",       value: "Собственная / летняя, с плитой" },
    { icon: "❄️", label: "Удобства",    value: "Кондиционер, Wi-Fi, ТВ, санузел" },
    { icon: "👨‍👩‍👦", label: "Аудитория",  value: "Семейный тихий отдых" },
    { icon: "💰", label: "Цена",        value: "5 000–7 500 ₽/сут (высокий сезон)" },
  ];
  return (
    <div className="rounded-xl border p-5" style={{ background: "#F8FBFF", borderColor: "#D9E7F5" }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {criteria.map((c) => (
          <div key={c.label} className="flex items-start gap-2.5">
            <span className="text-lg leading-tight">{c.icon}</span>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "#64748B" }}>{c.label}</p>
              <p className="text-sm text-gray-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: "#4A9EC4" }}>{label}</p>
      <p className="font-semibold text-sm" style={{ color: "#072B55" }}>{value}</p>
    </div>
  );
}
