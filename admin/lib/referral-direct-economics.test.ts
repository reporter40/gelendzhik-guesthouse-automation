import { describe, expect, test } from "vitest";
import { calculateReferralDirectEconomics } from "./referral-direct-economics";

describe("calculateReferralDirectEconomics (D2.0)", () => {
  test("market 10000, rc_net 8475 — canonical referral economics", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10000,
      rcNetPrice: 8475,
    });

    expect(r.referralPrice).toBe(9500);
    expect(r.referralReward).toBe(475);
    expect(r.referralOwnerNet).toBe(9025);
    expect(r.referralGuestSavings).toBe(500);
    expect(r.referralOwnerGainVsAggregator).toBe(550);
    expect(r.isReferralEconomicallyValid).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  test("guest savings and owner gain vs aggregator are positive when valid", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10000,
      rcNetPrice: 8475,
    });

    expect(r.referralGuestSavings).toBeGreaterThan(0);
    expect(r.referralOwnerGainVsAggregator).toBeGreaterThan(0);
  });

  test("invalid when referral_owner_net <= rc_net_price", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10000,
      rcNetPrice: 9500,
    });

    expect(r.isReferralEconomicallyValid).toBe(false);
    expect(r.warnings).toContain("referral_owner_net must exceed rc_net_price");
    expect(r.referralOwnerNet).toBe(9025);
  });

  test("invalid when referral_price >= market_guest_price (zero discount)", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10000,
      rcNetPrice: 8475,
      directDiscountRate: 0,
    });

    expect(r.referralPrice).toBe(10000);
    expect(r.isReferralEconomicallyValid).toBe(false);
    expect(r.warnings).toContain("referral_price must be below market_guest_price");
    expect(r.warnings).toContain("referral_guest_savings must be positive");
  });

  test("does not throw on null, undefined, or zero inputs", () => {
    for (const marketGuestPrice of [null, undefined, 0, NaN]) {
      const r = calculateReferralDirectEconomics({
        marketGuestPrice: marketGuestPrice as number | null | undefined,
        rcNetPrice: 8475,
      });
      expect(r.referralPrice).toBeNull();
      expect(r.isReferralEconomicallyValid).toBe(false);
      expect(r.warnings.length).toBeGreaterThan(0);
    }

    for (const rcNetPrice of [null, undefined, 0, NaN]) {
      const r = calculateReferralDirectEconomics({
        marketGuestPrice: 10000,
        rcNetPrice: rcNetPrice as number | null | undefined,
      });
      expect(r.referralPrice).toBeNull();
      expect(r.isReferralEconomicallyValid).toBe(false);
    }
  });

  test("rounding matches wf12 Math.round ruble convention", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10230,
      rcNetPrice: Math.round(10230 / 1.18),
    });

    expect(r.referralPrice).toBe(Math.round(10230 * 0.95));
    expect(r.referralReward).toBe(Math.round(r.referralPrice! * 0.05));
    expect(r.referralOwnerNet).toBe(r.referralPrice! - r.referralReward!);
  });

  test("custom commission and discount rates", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10000,
      rcNetPrice: 8000,
      referralCommissionRate: 0.1,
      directDiscountRate: 0.1,
    });

    expect(r.referralPrice).toBe(9000);
    expect(r.referralReward).toBe(900);
    expect(r.referralOwnerNet).toBe(8100);
    expect(r.isReferralEconomicallyValid).toBe(true);
  });

  test("falls back to default rates when rates are invalid", () => {
    const r = calculateReferralDirectEconomics({
      marketGuestPrice: 10000,
      rcNetPrice: 8475,
      referralCommissionRate: 1.5,
      directDiscountRate: -0.05,
    });

    expect(r.referralPrice).toBe(9500);
    expect(r.referralReward).toBe(475);
    expect(r.warnings.some((w) => w.includes("referral_commission_rate"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("direct_discount_rate"))).toBe(true);
  });
});
