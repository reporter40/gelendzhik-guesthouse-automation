import { describe, expect, test } from "vitest";
import {
  normalizeDefaultPropertyContext,
  normalizePropertyContextMapFromJsonText,
  normalizePropertyContextMapRecord,
} from "@/lib/property-context-settings";

describe("normalizePropertyContextMapFromJsonText", () => {
  test("parses object and trims entries", () => {
    const r = normalizePropertyContextMapFromJsonText('{ "50": " Аква ", "": "x", "41": "" }');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.map).toEqual({ "50": "Аква" });
  });

  test("empty text → empty map", () => {
    const r = normalizePropertyContextMapFromJsonText("   \n");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.map).toEqual({});
  });

  test("invalid JSON rejected", () => {
    expect(normalizePropertyContextMapFromJsonText("{ bad").ok).toBe(false);
  });

  test("array rejected", () => {
    expect(normalizePropertyContextMapFromJsonText('["a"]').ok).toBe(false);
  });
});

describe("normalizePropertyContextMapRecord", () => {
  test("coerces number values to string", () => {
    const r = normalizePropertyContextMapRecord({ "50": 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.map).toEqual({ "50": "1" });
  });

  test("nested object value rejected", () => {
    expect(normalizePropertyContextMapRecord({ "50": { a: 1 } }).ok).toBe(false);
  });
});

describe("normalizeDefaultPropertyContext", () => {
  test("trims", () => {
    expect(normalizeDefaultPropertyContext("  x  ")).toBe("x");
  });
});

describe("save API payload (server action input)", () => {
  test("builds object map for save, not invalid string", () => {
    const pr = normalizePropertyContextMapFromJsonText('{"40":"A"}');
    expect(pr.ok).toBe(true);
    if (!pr.ok) throw new Error();
    const body = {
      action: "property_context_settings",
      mode: "save",
      property_context_map: pr.map,
      default_property_context: normalizeDefaultPropertyContext("B"),
    };
    expect(() => JSON.stringify(body)).not.toThrow();
    expect(JSON.parse(JSON.stringify(body)).property_context_map).toEqual({ "40": "A" });
  });
});
