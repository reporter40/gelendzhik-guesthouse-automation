/**
 * D2.2 — map PricingRecommendation + referral economics → ReferralOfferInput.
 * Separate from direct-offer generator.
 */

import type { PricingRecommendation } from "@/lib/adminApi";
import type { DirectOfferSettings } from "@/lib/direct-offer-settings";
import {
  normalizeStayFieldsFromRow,
  rowPropertyContextFallback,
  rowUnitDisplayName,
} from "@/lib/direct-offer-from-recommendation";
import { DEFAULT_REFERRAL_REWARD_RATE } from "@/lib/referral-offer-generator";
import type { ReferralOfferInput } from "@/lib/referral-offer-generator";
import { computeReferralEconomicsFromRecommendation } from "@/lib/referral-economics-from-recommendation";

function mapFinitePositive(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

export function resolveReferralExampleAmounts(
  row: PricingRecommendation,
): { exampleBookingAmount: number | null; exampleReward: number | null } {
  const state = computeReferralEconomicsFromRecommendation(row);
  if (!state.hasRequiredInputs || !state.result.isReferralEconomicallyValid) {
    return { exampleBookingAmount: null, exampleReward: null };
  }

  const perNight = mapFinitePositive(state.result.referralPrice);
  if (perNight == null) {
    return { exampleBookingAmount: null, exampleReward: null };
  }

  const { nights } = normalizeStayFieldsFromRow(row);
  const nightsCount =
    nights != null && Number.isFinite(nights) && nights >= 1 ? Math.round(nights) : 1;

  const exampleBookingAmount = Math.round(perNight * nightsCount);
  const perNightReward = mapFinitePositive(state.result.referralReward);
  const exampleReward =
    perNightReward != null ? Math.round(perNightReward * nightsCount) : null;

  return { exampleBookingAmount, exampleReward };
}

export function buildReferralOfferInputFromRecommendation(
  row: PricingRecommendation,
  template?: Pick<DirectOfferSettings, "contactName" | "contactPhone" | "propertyName" | "bookingInstruction">,
): ReferralOfferInput | null {
  const state = computeReferralEconomicsFromRecommendation(row);
  if (!state.hasRequiredInputs || !state.result.isReferralEconomicallyValid) {
    return null;
  }

  const tplProp = template?.propertyName?.trim() ?? "";
  const rowProp = rowPropertyContextFallback(row);
  const propertyName = tplProp || rowProp || null;

  const { exampleBookingAmount, exampleReward } = resolveReferralExampleAmounts(row);

  const cn = template?.contactName?.trim();
  const cp = template?.contactPhone?.trim();
  const bi = template?.bookingInstruction?.trim();

  return {
    propertyName,
    unitName: rowUnitDisplayName(row),
    referralRewardRate: DEFAULT_REFERRAL_REWARD_RATE,
    exampleBookingAmount,
    exampleReward,
    contactName: cn ? cn : null,
    contactPhone: cp ? cp : null,
    bookingInstruction: bi ? bi : null,
  };
}
