import { requireAuth } from "@/lib/session";
import {
  adminApi,
  fetchAuditLog,
  AdminApiError,
  RevenueData,
  CompetitorPriceObservation,
  AuditLogEntry,
} from "@/lib/adminApi";
import CompetitorForm from "./CompetitorForm";
import { ApprovalsPanel } from "./ApprovalsPanel";

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n)) return fallback;
  return n.toLocaleString("ru-RU");
}


export default async function RevenuePage() {
  await requireAuth();

  let data: RevenueData | null = null;
  let error: string | null = null;
  let auditLog: AuditLogEntry[] = [];

  try {
    [data, auditLog] = await Promise.all([
      adminApi("revenue"),
      fetchAuditLog().catch(() => []),
    ]);
  } catch (e) {
    error = e instanceof AdminApiError ? e.message : "Ошибка загрузки данных";
  }

  const summary      = data?.summary;
  const gaps         = data?.gap_windows             ?? [];
  const comps        = data?.competitor_prices       ?? [];
  const recs         = data?.pricing_recommendations ?? [];
  const sources      = data?.latest_observations ?? [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Revenue Intelligence</h1>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Summary cards ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SCard label="Маленьких окон"    value={String(summary.total_gaps)}            accent />
          <SCard label="Потери ₽"          value={fmt(summary.total_estimated_loss)}      />
          <SCard label="Конкурентов"        value={String(summary.active_competitors_count ?? summary.competitor_count)} />
          <SCard label="Медиана рынка ₽"   value={fmt(summary.latest_market_median_from_sources ?? summary.market_median)} />
          <SCard label="Рекомендации"      value={String(summary.recommendations_count)} accent={recs.length > 0} />
          <SCard label="1+2+3 ночи"
            value={`${summary.one_night_gaps}+${summary.two_night_gaps}+${summary.three_night_gaps}`} />
        </div>
      )}

      {/* ── Market summary (from competitor_sources) ── */}
      {summary && (summary.latest_market_min_from_sources || summary.market_min) && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">
            Рыночные цены прямых конкурентов
          </p>
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="Минимум"  value={fmt(summary.latest_market_min_from_sources ?? summary.market_min, "нет данных")} />
            <Stat label="Медиана"  value={fmt(summary.latest_market_median_from_sources ?? summary.market_median, "нет данных")} />
            <Stat label="Среднее"  value={fmt(summary.latest_market_avg_from_sources ?? summary.market_avg, "нет данных")} />
            <Stat label="Максимум" value={fmt(summary.latest_market_max_from_sources ?? summary.market_max, "нет данных")} />
          </div>
          {summary.excluded_competitors_count != null && (
            <p className="text-xs text-indigo-400 mt-2">
              Активных источников: {summary.active_competitors_count ?? "?"} / Исключено: {summary.excluded_competitors_count}
            </p>
          )}
        </div>
      )}

      {/* ── Критерии отбора ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Критерии отбора конкурентов</h2>
        <SelectionCriteria />
      </section>

      {/* ── Прямые конкуренты (C1.5) ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Прямые конкуренты</h2>
        {sources.length > 0 ? (
          <ObservationsTable observations={sources} />
        ) : (
          <p className="text-sm text-gray-500">Данные наблюдений загружаются из Admin API…</p>
        )}

        {/* Кнопки будущего C2/C3 */}
        <div className="mt-3 flex gap-2">
          <button disabled className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-300 cursor-not-allowed">
            Проверить цену сейчас (C3)
          </button>
          <button disabled className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-300 cursor-not-allowed">
            Добавить наблюдение вручную (C2)
          </button>
        </div>
      </section>

      {/* ── Pricing Recommendations + Audit Log (C2.0) ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Ценовые рекомендации</h2>
        <ApprovalsPanel recs={recs} auditLog={auditLog} />
      </section>

      {/* ── Gap Windows ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Маленькие окна между бронями
        </h2>
        {gaps.length === 0 ? (
          <p className="text-sm text-gray-500">Маленьких окон не найдено.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Номер", "Окно", "Ночей", "Потери ₽", "Рекомендация"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {gaps.map((g, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">№{g.apartment_id}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{g.gap_start} — {g.gap_end}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        g.nights === 1 ? "bg-red-100 text-red-700" :
                        g.nights === 2 ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                      }`}>{g.nights}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(g.estimated_loss)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{g.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Competitor Prices (manual form) ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Добавить цену конкурента вручную</h2>
        <CompetitorForm />

        {comps.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Источник", "Объект", "Период", "₽/ночь", "Рейтинг", "Отзывы"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {comps.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{c.source}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                           className="text-indigo-600 hover:underline">{c.title}</a>
                      ) : c.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{c.date_from} — {c.date_to}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(c.price_per_night)}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{c.rating ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{c.reviews_count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ObservationsTable({ observations }: { observations: CompetitorPriceObservation[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Конкурент", "Сходство", "Период наблюдения", "₽/ночь", "Уверенность", "Метод", "Дата записи"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {observations.map((o, i) => {
            const isStale = o.observed_at && (Date.now() - new Date(o.observed_at).getTime()) > 14 * 86400000;
            const isSeed = o.collection_method === "seed_from_pdf_report";
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <a href={o.competitor_url} target="_blank" rel="noopener noreferrer"
                     className="text-indigo-600 hover:underline">
                    {o.competitor_name}
                  </a>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    o.similarity_score >= 90 ? "bg-green-100 text-green-700" :
                    o.similarity_score >= 80 ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>{o.similarity_score}%</span>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {o.stay_date_from} — {o.stay_date_to}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {o.price_per_night ? fmt(o.price_per_night) : "—"}
                </td>
                <td className="px-4 py-3 text-center text-gray-500">
                  {o.confidence != null ? `${Math.round(o.confidence * 100)}%` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    isSeed ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {isSeed ? "seed/PDF" : o.collection_method}
                  </span>
                  {(isStale || isSeed) && (
                    <span className="ml-1 text-amber-500 text-xs" title="Данные устарели или seed">⚠️</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
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

function SelectionCriteria() {
  const criteria = [
    { icon: "📍", label: "Район", value: "Толстый мыс / центр, Геленджик" },
    { icon: "🏖️", label: "Пляж", value: "≤ 700 м (5–7 мин пешком)" },
    { icon: "📐", label: "Площадь", value: "30–55 м²" },
    { icon: "👨‍👩‍👧", label: "Вместимость", value: "4–6 гостей" },
    { icon: "🍳", label: "Кухня", value: "Собственная / летняя, с плитой" },
    { icon: "❄️", label: "Удобства", value: "Кондиционер, Wi-Fi, ТВ, санузел" },
    { icon: "👨‍👩‍👦", label: "Аудитория", value: "Семейный тихий отдых" },
    { icon: "💰", label: "Цена", value: "5 000–7 500 ₽/сут (высокий сезон)" },
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {criteria.map((c) => (
          <div key={c.label} className="flex items-start gap-2">
            <span className="text-lg leading-tight">{c.icon}</span>
            <div>
              <p className="text-xs font-semibold text-gray-500">{c.label}</p>
              <p className="text-sm text-gray-800">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function SCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-indigo-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-indigo-400">{label}</p>
      <p className="font-semibold text-indigo-900">{value}</p>
    </div>
  );
}
