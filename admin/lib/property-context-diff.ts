/** D1.7 — pure diff для property_context_map (совпадает с логикой PCS Save Build Audit). */

export type PropertyContextDiff = {
  added_keys: string[];
  changed_keys: string[];
  removed_keys: string[];
  unchanged_keys_count: number;
  previous_size: number;
  next_size: number;
};

function sortAsc(a: string[]): string[] {
  return [...a].sort((x, y) => x.localeCompare(y, "ru"));
}

export function computePropertyContextMapDiff(
  prev: Record<string, string>,
  next: Record<string, string>,
): PropertyContextDiff {
  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));
  const added_keys = sortAsc([...nextKeys].filter((k) => !prevKeys.has(k)));
  const removed_keys = sortAsc([...prevKeys].filter((k) => !nextKeys.has(k)));
  const changed_keys = sortAsc(
    [...nextKeys].filter((k) => {
      if (!prevKeys.has(k)) return false;
      return prev[k] !== next[k];
    }),
  );
  const unchanged_keys_count = [...nextKeys].filter(
    (k) => prevKeys.has(k) && prev[k] === next[k],
  ).length;
  return {
    added_keys,
    changed_keys,
    removed_keys,
    unchanged_keys_count,
    previous_size: Object.keys(prev).length,
    next_size: Object.keys(next).length,
  };
}
