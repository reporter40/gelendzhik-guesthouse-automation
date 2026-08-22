import { describe, expect, test } from "vitest";
import type { PricingRecommendation } from "@/lib/adminApi";
import {
  buildReferralOfferInputFromRecommendation,
  resolveReferralExampleAmounts,
} from "./referral-offer-from-recommendation";

function baseRow(over: Partial<PricingRecommendation> = {}): PricingRecommendation {
  return {
    apartment_id: "50",
    apartment_name: "Студия с видом",
    property_context: "Акваторинг",
    date_from: "2026-07-15",
    date_to: "2026-07-17",
    nights: 2,
    current_price: 7000,
    market_median: 11000,
    recommended_price: 10000,
    recommended_guest_price: 10000,
    expected_aggregator_guest_price: 10000,
    rc_net_price: 8475,
    direct_price: 9500,
    recommendation_type: "gap_fill_moderate",
    reason: "test",
    confidence: 0.8,
    status: "draft",
    ...over,
  };
}

describe("buildReferralOfferInputFromRecommendation (D2.2)", () => {
  test("returns null when referral economics invalid", () => {
    expect(
      buildReferralOfferInputFromRecommendation(baseRow({ rc_net_price: 9500 })),
    ).toBeNull();
  });

  test("unitName from apartment_name, propertyName from property_context", () => {
    const input = buildReferralOfferInputFromRecommendation(baseRow());
    expect(input).not.toBeNull();
    expect(input!.unitName).toContain("Студия");
    expect(input!.propertyName).toBe("Акваторинг");
  });

  test("propertyName prefers template over row context", () => {
    const input = buildReferralOfferInputFromRecommendation(baseRow(), {
      propertyName: "Шаблон дом",
      contactName: "",
      contactPhone: "",
      bookingInstruction: "",
    });
    expect(input!.propertyName).toBe("Шаблон дом");
  });

  test("example amounts from valid economics (referralPrice × nights)", () => {
    const amounts = resolveReferralExampleAmounts(baseRow());
    expect(amounts.exampleBookingAmount).toBe(9500 * 2);
    expect(amounts.exampleReward).toBe(475 * 2);

    const input = buildReferralOfferInputFromRecommendation(baseRow());
    expect(input!.exampleBookingAmount).toBe(19000);
    expect(input!.exampleReward).toBe(950);
  });

  test("invalid economics yields no example amounts", () => {
    const amounts = resolveReferralExampleAmounts(baseRow({ rc_net_price: null }));
    expect(amounts.exampleBookingAmount).toBeNull();
    expect(amounts.exampleReward).toBeNull();
  });
});
