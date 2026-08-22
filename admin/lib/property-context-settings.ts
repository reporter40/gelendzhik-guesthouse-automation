/**
 * D1.6 — нормализация property_context_map на фронте (дублирует логику workflow до отправки).
 */

export type NormalizeMapResult =
  | { ok: true; map: Record<string, string> }
  | { ok: false; error: string };

/** Распарсить JSON-текст в объект string→string; отбросить пустые ключи/значения. */
export function normalizePropertyContextMapFromJsonText(text: string): NormalizeMapResult {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, map: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, error: "Невалидный JSON" };
  }
  return normalizePropertyContextMapRecord(parsed);
}

export function normalizePropertyContextMapRecord(input: unknown): NormalizeMapResult {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Ожидается JSON-объект { \"id\": \"название\" }, не массив" };
  }
  const src = input as Record<string, unknown>;
  const map: Record<string, string> = {};
  for (const [k0, v0] of Object.entries(src)) {
    const ks = String(k0).trim();
    if (!ks) continue;
    let vs = "";
    if (v0 != null) {
      if (typeof v0 === "string" || typeof v0 === "number" || typeof v0 === "boolean") {
        vs = String(v0).trim();
      } else {
        return {
          ok: false,
          error: `Ключ "${ks}": значение должно быть строкой (или числом для приведения к строке)`,
        };
      }
    }
    if (!vs) continue;
    map[ks] = vs;
  }
  return { ok: true, map };
}

export function normalizeDefaultPropertyContext(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}
