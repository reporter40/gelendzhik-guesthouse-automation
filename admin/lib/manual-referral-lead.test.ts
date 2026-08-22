import { describe, expect, test } from "vitest";
import {
  buildManualReferralLeadMetadata,
  buildManualReferralLeadPrefillFromRecommendation,
  normalizeManualReferralLeadInput,
  prepareManualReferralLeadForSave,
} from "./manual-referral-lead";
import type { PricingRecommendation } from "@/lib/adminApi";

function baseRow(over: Partial<PricingRecommendation> = {}): PricingRecommendation {
  return {
    apartment_id: "50",
    apartment_name: "Студия",
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

describe("manual-referral-lead (D2.3)", () => {
  test("referrer requires name or contact", () => {
    const r = prepareManualReferralLeadForSave({
      referred_guest_name: "Иван",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/рекомендующего/i);
  });

  test("referred guest requires name or contact", () => {
    const r = prepareManualReferralLeadForSave({
      referrer_name: "Мария",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/рекомендуемого/i);
  });

  test("trims strings and drops empty to null", () => {
    const n = normalizeManualReferralLeadInput({
      referrer_name: "  Анна  ",
      referrer_contact: "   ",
      referred_guest_contact: "+7",
      notes: "",
    });
    expect(n.referrer_name).toBe("Анна");
    expect(n.referrer_contact).toBeNull();
    expect(n.referred_guest_contact).toBe("+7");
    expect(n.notes).toBeNull();
  });

  test("rejects invalid negative reward", () => {
    const r = prepareManualReferralLeadForSave({
      referrer_name: "A",
      referred_guest_name: "B",
      referral_reward: -10,
    });
    expect(r.ok).toBe(false);
  });

  test("positive economics accepted in metadata", () => {
    const input = normalizeManualReferralLeadInput({
      referrer_name: "A",
      referred_guest_name: "B",
      referral_price: 9500,
      referral_reward: 475,
      apartment_id: "50",
      date_from: "2026-07-15",
      date_to: "2026-07-17",
    });
    const meta = buildManualReferralLeadMetadata(input);
    expect(meta.economics_available).toBe(true);
    expect(meta.referral_price).toBe(9500);
    expect(meta.referral_reward).toBe(475);
    expect(meta.apartment_id).toBe("50");
    expect(meta.date_from).toBe("2026-07-15");
  });

  test("missing economics sets economics_available false", () => {
    const input = normalizeManualReferralLeadInput({
      referrer_name: "A",
      referred_guest_contact: "+1",
    });
    const meta = buildManualReferralLeadMetadata(input);
    expect(meta.economics_available).toBe(false);
    expect(meta).not.toHaveProperty("referral_price");
  });

  test("prefill from valid recommendation row", () => {
    const pre = buildManualReferralLeadPrefillFromRecommendation(baseRow());
    expect(pre.referral_price).toBe(9500);
    expect(pre.referral_reward).toBe(475);
    expect(pre.apartment_id).toBe("50");
  });

  test("invalid economics prefill omits amounts", () => {
    const pre = buildManualReferralLeadPrefillFromRecommendation(
      baseRow({ rc_net_price: 9500 }),
    );
    expect(pre.referral_price).toBeUndefined();
    expect(pre.apartment_id).toBe("50");
  });
});
