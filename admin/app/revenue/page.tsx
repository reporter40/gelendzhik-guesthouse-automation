import { requireAuth } from "@/lib/session";
import { adminApi, AdminApiError, RevenueData, PricingRecommendation } from "@/lib/adminApi";
import CompetitorForm from "./CompetitorForm";

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n)) return fallback;
  return n.toLocaleString("ru-RU");
}

const REC_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  gap_special_price: { label: "Спеццена",       cls: "bg-yellow-100 text-yellow-800" },
  raise_price:       { label: "↑ Повысить",     cls: "bg-green-100 text-green-800"  },
  lower_price:       { label: "↓ Снизить",      cls: "bg-red-100 text-red-800"      },
  hold_price:        { label: "= Держать",      cls: "bg-gray-100 text-gray-600"    },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "черновик", cls: "bg-gray-100 text-gray-500"     },
  approved: { label: "одобрено", cls: "bg-blue-100 text-blue-700"     },
  applied:  { label: "применено", cls: "bg-green-100 text-green-700"  },
  rejected: { label: "отклонено", cls: "bg-red-100 text-red-600"      },
};

export default async function RevenuePage() {
  await requireAuth();

  let data: RevenueData | null = null;
  let error: string | null = null;

  try {
    data = await adminApi("revenue");
  } catch (e) {
    error = e instanceof AdminApiError ? e.message : "Ошибка загрузки данных";
  }

  const summary = data?.summary;
  const gaps    = data?.gap_windows          ?? [];
  const comps   = data?.competitor_prices    ?? [];
  const recs    = data?.pricing_recommendations ?? [];

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
          <SCard label="Маленьких окон"   value={String(summary.total_gaps)}         accent />
          <SCard label="Потери ₽"         value={fmt(summary.total_estimated_loss)}  />
          <SCard label="Конкуренты"       value={String(summary.competitor_count)}   />
          <SCard label="Медиана рынка ₽"  value={fmt(summary.market_median)}         />
          <SCard label="Рекомендации"     value={String(summary.recommendations_count)} accent={recs.length > 0} />
          <SCard label="1+2+3 ночи"
            value={`${summary.one_night_gaps}+${summary.two_night_gaps}+${summary.three_night_gaps}`} />
        </div>
      )}

      {/* ── Market summary row ── */}
      {summary && (summary.market_min || summary.market_max) && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">
            Рыночные цены конкурентов (±30 дней)
          </p>
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="Минимум"  value={fmt(summary.market_min,  "нет данных")} />
            <Stat label="Медиана"  value={fmt(summary.market_median, "нет данных")} />
            <Stat label="Среднее"  value={fmt(summary.market_avg,  "нет данных")} />
            <Stat label="Максимум" value={fmt(summary.market_max,  "нет данных")} />
          </div>
        </div>
      )}

      {/* ── Pricing Recommendations ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Ценовые рекомендации</h2>
        {recs.length === 0 ? (
          <p className="text-sm text-gray-500">
            Рекомендаций нет. Добавьте конкурентов и/или подождите следующего запуска workflow 12.
          </p>
        ) : (
          <RecommendationsTable recs={recs} />
        )}
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
                    <td className="px-4 py-3 font-medium text-gray-900">№{g.apartment_id} {g.apartment_name}</td>
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

      {/* ── Competitor Prices ── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Цены конкурентов</h2>

        {/* Active form via Server Action */}
        <CompetitorForm />

        {comps.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Цены конкурентов пока не добавлены.</p>
        ) : (
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

function RecommendationsTable({ recs }: { recs: PricingRecommendation[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Номер", "Период", "Тип", "Текущая ₽", "Медиана ₽", "Рек. цена ₽", "Уверенность", "Причина", "Статус", "C2"].map((h) => (
              <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {recs.map((r, i) => {
            const recMeta  = REC_TYPE_LABELS[r.recommendation_type] ?? { label: r.recommendation_type, cls: "bg-gray-100 text-gray-600" };
            const statMeta = STATUS_LABELS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-500" };
            const conf = r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—";
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">№{r.apartment_id}</td>
                <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{r.date_from} — {r.date_to}<br/><span className="text-gray-400 text-xs">{r.nights} н.</span></td>
                <td className="px-3 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${recMeta.cls}`}>{recMeta.label}</span>
                </td>
                <td className="px-3 py-3 text-right text-gray-600">{r.current_price != null ? fmt(r.current_price) : "—"}</td>
                <td className="px-3 py-3 text-right text-gray-600">{r.market_median != null ? fmt(r.market_median) : "—"}</td>
                <td className="px-3 py-3 text-right font-bold text-gray-900">{fmt(r.recommended_price)}</td>
                <td className="px-3 py-3 text-center text-gray-500">{conf}</td>
                <td className="px-3 py-3 text-gray-600 max-w-xs text-xs">{r.reason}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statMeta.cls}`}>{statMeta.label}</span>
                </td>
                <td className="px-3 py-3">
                  <button disabled className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-300 cursor-not-allowed">
                    Применить ↗
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
