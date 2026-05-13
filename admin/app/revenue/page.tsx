import { requireAuth } from "@/lib/session";
import { adminApi, RevenueData } from "@/lib/adminApi";
import { AdminApiError } from "@/lib/adminApi";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU");
}

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
  const gaps = data?.gap_windows ?? [];
  const competitors = data?.competitor_prices ?? [];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Revenue Intelligence</h1>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard label="Маленьких окон" value={String(summary.total_gaps)} accent />
          <SummaryCard label="Потери (₽)" value={fmt(summary.total_estimated_loss)} />
          <SummaryCard label="1 ночь" value={String(summary.one_night_gaps)} />
          <SummaryCard label="2 ночи" value={String(summary.two_night_gaps)} />
          <SummaryCard label="3 ночи" value={String(summary.three_night_gaps)} />
        </div>
      )}

      {/* Gap Windows table */}
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
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {gaps.map((g, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      №{g.apartment_id} {g.apartment_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {g.gap_start} — {g.gap_end}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          g.nights === 1
                            ? "bg-red-100 text-red-700"
                            : g.nights === 2
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {g.nights}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmt(g.estimated_loss)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{g.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Competitor Prices table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Цены конкурентов</h2>
        {competitors.length === 0 ? (
          <p className="text-sm text-gray-500">
            Цены конкурентов пока не добавлены.{" "}
            <span className="text-gray-400">(Ручной ввод — следующий шаг C1)</span>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Источник", "Объект", "Период", "₽/ночь", "Рейтинг", "Отзывы"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {competitors.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{c.source}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {c.date_from} — {c.date_to}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmt(c.price_per_night)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {c.rating ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {c.reviews_count ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Disabled form placeholder */}
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-500">
            Добавление цены конкурента{" "}
            <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
              доступно в C1
            </span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 opacity-40 pointer-events-none select-none">
            <input
              disabled
              placeholder="Источник (Авито, Booking…)"
              className="col-span-2 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <input disabled placeholder="Название объекта" className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <input disabled placeholder="Цена за ночь ₽" className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <input disabled placeholder="Дата от" className="rounded border border-gray-300 px-3 py-2 text-sm" />
            <input disabled placeholder="Дата до" className="rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-indigo-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
