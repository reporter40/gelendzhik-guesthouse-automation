import { describe, expect, test } from "vitest";
import type { PricingRecommendation } from "@/lib/adminApi";
import {
  buildReferralEconomicsInputFromRecommendation,
  computeReferralEconomicsFromRecommendation,
  resolveMarketGuestPriceFromRecommendation,
  resolveRcNetPriceFromRecommendation,
} from "./referral-economics-from-recommendation";

function baseRow(over: Partial<PricingRecommendation> = {}): PricingRecommendation {
  return {
    apartment_id: "50",
    apartment_name: "Студия",
    date_from: "2026-07-15",
    date_to: "2026-07-17",
    nights: 2,
    current_price: 7000,
    market_median: 11000,
    recommended_price: 10230,
    recommended_guest_price: 10230,
    expected_aggregator_guest_price: 10229,
    rc_net_price: 8670,
    direct_price: 9719,
    recommendation_type: "gap_fill_moderate",
    reason: "test",
    confidence: 0.8,
    status: "draft",
    ...over,
  };
}

describe("resolveMarketGuestPriceFromRecommendation (D2.1)", () => {
  test("prefers expected_aggregator_guest_price", () => {
    expect(resolveMarketGuestPriceFromRecommendation(baseRow())).toBe(10229);
  });

  test("falls back to recommended_guest_price", () => {
    expect(
      resolveMarketGuestPriceFromRecommendation(
        baseRow({ expected_aggregator_guest_price: null }),
      ),
    ).toBe(10230);
  });

  test("falls back to recommended_price", () => {
    expect(
      resolveMarketGuestPriceFromRecommendation(
        baseRow({
          expected_aggregator_guest_price: null,
          recommended_guest_price: null,
        }),
      ),
    ).toBe(10230);
  });

  test("falls back to market_median", () => {
    expect(
      resolveMarketGuestPriceFromRecommendation(
        baseRow({
          expected_aggregator_guest_price: null,
          recommended_guest_price: null,
          recommended_price: 0,
        }),
      ),
    ).toBe(11000);
  });
});

describe("resolveRcNetPriceFromRecommendation (D2.1)", () => {
  test("requires positive rc_net_price", () => {
    expect(resolveRcNetPriceFromRecommendation(baseRow())).toBe(8670);
    expect(resolveRcNetPriceFromRecommendation(baseRow({ rc_net_price: null }))).toBeNull();
    expect(resolveRcNetPriceFromRecommendation(baseRow({ rc_net_price: 0 }))).toBeNull();
  });
});

describe("buildReferralEconomicsInputFromRecommendation (D2.1)", () => {
  test("returns null when rc_net_price missing", () => {
    expect(
      buildReferralEconomicsInputFromRecommendation(baseRow({ rc_net_price: null })),
    ).toBeNull();
  });

  test("passes resolved numbers to calculateReferralDirectEconomics", () => {
    const input = buildReferralEconomicsInputFromRecommendation(
      baseRow({ expected_aggregator_guest_price: 10000, rc_net_price: 8475 }),
    );
    expect(input).toEqual({ marketGuestPrice: 10000, rcNetPrice: 8475 });

    const state = computeReferralEconomicsFromRecommendation(
      baseRow({ expected_aggregator_guest_price: 10000, rc_net_price: 8475 }),
    );
    expect(state.hasRequiredInputs).toBe(true);
    if (state.hasRequiredInputs) {
      expect(state.result.referralPrice).toBe(9500);
      expect(state.result.isReferralEconomicallyValid).toBe(true);
    }
  });

  test("invalid row does not throw", () => {
    expect(() =>
      computeReferralEconomicsFromRecommendation(
        baseRow({
          expected_aggregator_guest_price: null,
          recommended_guest_price: null,
          recommended_price: 0,
          market_median: null,
          rc_net_price: null,
        }),
      ),
    ).not.toThrow();

    const state = computeReferralEconomicsFromRecommendation(
      baseRow({ rc_net_price: null }),
    );
    expect(state.hasRequiredInputs).toBe(false);
    if (!state.hasRequiredInputs) {
      expect(state.insufficientDataWarning).toContain("Недостаточно данных");
    }
  });
});
