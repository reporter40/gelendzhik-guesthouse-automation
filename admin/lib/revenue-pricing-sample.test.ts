import { describe, expect, test } from "vitest";
import sample from "@/test-fixtures/revenue-pricing-sample.json";

describe("revenue pricing sample fixture (D1.4)", () => {
  test("has one recommendation with property_context Акваторинг and one without", () => {
    const recs = sample.pricing_recommendations;
    expect(recs.some((r) => r.property_context === "Акваторинг")).toBe(true);
    expect(recs.some((r) => r.property_context == null || r.property_context === "")).toBe(true);
  });
});
