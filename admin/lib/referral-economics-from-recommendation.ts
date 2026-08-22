/**
 * D2.1 — map PricingRecommendation → referral economics input (display only).
 * Separate from direct-offer generator and D1.9 presets.
 */

import type { PricingRecommendation } from "@/lib/adminApi";
import {
  calculateReferralDirectEconomics,
  type ReferralDirectEconomicsInput,
  type ReferralDirectEconomicsResult,
} from "@/lib/referral-direct-economics";

function mapFinitePositive(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

/** Guest-facing market price priority for referral economics. */
export function resolveMarketGuestPriceFromRecommendation(
  row: PricingRecommendation,
): number | null {
  return (
    mapFinitePositive(row.expected_aggregator_guest_price) ??
    mapFinitePositive(row.recommended_guest_price) ??
    mapFinitePositive(row.recommended_price) ??
    mapFinitePositive(row.market_median)
  );
}

export function resolveRcNetPriceFromRecommendation(
  row: PricingRecommendation,
): number | null {
  return mapFinitePositive(row.rc_net_price);
}

export function buildReferralEconomicsInputFromRecommendation(
  row: PricingRecommendation,
): ReferralDirectEconomicsInput | null {
  const marketGuestPrice = resolveMarketGuestPriceFromRecommendation(row);
  const rcNetPrice = resolveRcNetPriceFromRecommendation(row);
  if (marketGuestPrice == null || rcNetPrice == null) return null;
  return { marketGuestPrice, rcNetPrice };
}

export type ReferralEconomicsPreviewState =
  | {
      hasRequiredInputs: false;
      insufficientDataWarning: string;
    }
  | {
      hasRequiredInputs: true;
      input: ReferralDirectEconomicsInput;
      result: ReferralDirectEconomicsResult;
    };

export function computeReferralEconomicsFromRecommendation(
  row: PricingRecommendation,
): ReferralEconomicsPreviewState {
  const input = buildReferralEconomicsInputFromRecommendation(row);
  if (!input) {
    return {
      hasRequiredInputs: false,
      insufficientDataWarning: "Недостаточно данных для referral economics.",
    };
  }
  return {
    hasRequiredInputs: true,
    input,
    result: calculateReferralDirectEconomics(input),
  };
}
