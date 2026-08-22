import { describe, expect, test } from "vitest";

/**
 * Зеркало metaObj в WF10 → «Export RC DB Update» (workflows/10_admin_api.json).
 * property_context — только для UI revenue; в audit metadata RC не попадает.
 */
const RC_EXPORT_AUDIT_META_KEYS = [
  "prices_obj",
  "manual_instruction",
  "recommended_guest_price",
  "rc_net_price",
  "aggregator_markup_percent",
  "expected_aggregator_guest_price",
  "direct_price",
  "direct_savings_for_guest",
  "direct_owner_gain",
] as const;

describe("RC export audit metadata (D1.4)", () => {
  test("whitelist does not include property_context", () => {
    expect(RC_EXPORT_AUDIT_META_KEYS as readonly string[]).not.toContain("property_context");
  });
});
