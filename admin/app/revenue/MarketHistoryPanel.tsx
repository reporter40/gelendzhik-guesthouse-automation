import type { MarketHistoryData, MarketHistoryEntry } from "@/lib/adminApi";

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n)) return fallback;
  return n.toLocaleString("ru-RU");
}

function Bar({ value, max, color = "bg-indigo-400" }: { value: number | null; max: number; color?: string }) {
  if (!value || !max) return <div className="h-3 w-full bg-gray-100 rounded" />;
  const pct = Math.round((value / max) * 100);
  return (
    <div className="h-3 w-full bg-gray-100 rounded overflow-hidden">
      <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MarketHistoryPanel({ data }: { data: MarketHistoryData }) {
  const maxMedian = Math.max(...(data.data.map((r) => r.median_price ?? 0)));
  const allFresh  = data.total_stale === 0 && data.total_fresh > 0;
  const allStale  = data.total_fresh === 0 && data.total_stale > 0;

  return (
    <div className="space-y-4">
      {/* ── Freshness summary ── */}
      <div className="flex flex-wrap gap-3">
        <FreshBadge
          label="Fresh ≤ 14 дней"
          count={data.total_fresh}
          total={data.total_observations}
          color={allFresh ? "green" : "yellow"}
        />
        <FreshBadge
          label="Stale > 14 дней"
          count={data.total_stale}
          total={data.total_observations}
          color={allStale ? "red" : data.total_stale > 0 ? "yellow" : "green"}
        />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500">
          <span className="font-medium text-gray-700">Последнее:</span>
          {data.latest_obs_date ?? "нет данных"}
        </div>
      </div>

      {data.data.length === 0 ? (
        <p className="text-sm text-gray-500">Наблюдений нет. Добавьте первое вручную ↓</p>
      ) : (
        /* ── History table ── */
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Дата набл.", "Наблюд.", "Fresh", "Stale", "Min ₽", "Медиана ₽", "Avg ₽", "Max ₽", "Визуализация"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.data.map((row, i) => (
                <HistoryRow key={i} row={row} maxMedian={maxMedian} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row, maxMedian }: { row: MarketHistoryEntry; maxMedian: number }) {
  const isStale = row.stale_count > 0;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap">{row.obs_date}</td>
      <td className="px-3 py-2.5 text-center text-gray-700">{row.count}</td>
      <td className="px-3 py-2.5 text-center">
        {row.fresh_count > 0 ? (
          <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">{row.fresh_count}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5 text-center">
        {row.stale_count > 0 ? (
          <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">{row.stale_count}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5 text-right text-gray-600">{fmt(row.min_price)}</td>
      <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">{fmt(row.median_price)}</td>
      <td className="px-3 py-2.5 text-right text-gray-600">{fmt(row.avg_price)}</td>
      <td className="px-3 py-2.5 text-right text-gray-600">{fmt(row.max_price)}</td>
      <td className="px-3 py-2.5 min-w-[120px]">
        <Bar value={row.median_price} max={maxMedian} color={isStale ? "bg-amber-300" : "bg-indigo-400"} />
        {isStale && <span className="text-xs text-amber-500 ml-1">⚠ stale</span>}
      </td>
    </tr>
  );
}

function FreshBadge({
  label, count, total, color,
}: { label: string; count: number; total: number; color: "green" | "yellow" | "red" }) {
  const cls =
    color === "green"  ? "border-green-200 bg-green-50 text-green-700" :
    color === "yellow" ? "border-amber-200 bg-amber-50 text-amber-700" :
                         "border-red-200 bg-red-50 text-red-700";
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${cls}`}>
      <span>{label}:</span>
      <span className="font-bold text-base leading-tight">{count}</span>
      {total > 0 && <span className="text-opacity-70">/ {total}</span>}
    </div>
  );
}
