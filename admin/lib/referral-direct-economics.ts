/**
 * D2.0 — Referral Direct Booking economics (isolated calculation layer).
 * Does not modify direct_price, rc_net_price, RealtyCalendar export, or D1.9 presets.
 */

export const DEFAULT_REFERRAL_COMMISSION_RATE = 0.05;
export const DEFAULT_DIRECT_DISCOUNT_RATE = 0.05;

export type ReferralDirectEconomicsInput = {
  marketGuestPrice: number | null | undefined;
  rcNetPrice: number | null | undefined;
  referralCommissionRate?: number;
  directDiscountRate?: number;
};

export type ReferralDirectEconomicsResult = {
  referralPrice: number | null;
  referralReward: number | null;
  referralOwnerNet: number | null;
  referralGuestSavings: number | null;
  referralOwnerGainVsAggregator: number | null;
  isReferralEconomicallyValid: boolean;
  warnings: string[];
};

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function resolveCommissionRate(
  value: number | undefined,
  warnings: string[],
): number {
  if (value === undefined) return DEFAULT_REFERRAL_COMMISSION_RATE;
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    warnings.push(
      `referral_commission_rate invalid; using default ${DEFAULT_REFERRAL_COMMISSION_RATE}`,
    );
    return DEFAULT_REFERRAL_COMMISSION_RATE;
  }
  return value;
}

function resolveDiscountRate(
  value: number | undefined,
  warnings: string[],
): number {
  if (value === undefined) return DEFAULT_DIRECT_DISCOUNT_RATE;
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    warnings.push(
      `direct_discount_rate invalid; using default ${DEFAULT_DIRECT_DISCOUNT_RATE}`,
    );
    return DEFAULT_DIRECT_DISCOUNT_RATE;
  }
  return value;
}

function emptyResult(warnings: string[]): ReferralDirectEconomicsResult {
  return {
    referralPrice: null,
    referralReward: null,
    referralOwnerNet: null,
    referralGuestSavings: null,
    referralOwnerGainVsAggregator: null,
    isReferralEconomicallyValid: false,
    warnings,
  };
}

/**
 * Referral funnel economics:
 * - referralPrice = marketGuestPrice * (1 - directDiscountRate)
 * - referralReward = referralPrice * referralCommissionRate
 * - referralOwnerNet = referralPrice - referralReward
 * - referralGuestSavings = marketGuestPrice - referralPrice
 * - referralOwnerGainVsAggregator = referralOwnerNet - rcNetPrice
 *
 * Rounding follows wf12 pricing: Math.round on ruble amounts derived from rates.
 */
export function calculateReferralDirectEconomics(
  input: ReferralDirectEconomicsInput,
): ReferralDirectEconomicsResult {
  const warnings: string[] = [];

  if (!isPositiveFinite(input.marketGuestPrice)) {
    warnings.push("market_guest_price missing or not positive");
    return emptyResult(warnings);
  }
  if (!isPositiveFinite(input.rcNetPrice)) {
    warnings.push("rc_net_price missing or not positive");
    return emptyResult(warnings);
  }

  const marketGuestPrice = Math.round(input.marketGuestPrice);
  const rcNetPrice = Math.round(input.rcNetPrice);
  const referralCommissionRate = resolveCommissionRate(
    input.referralCommissionRate,
    warnings,
  );
  const directDiscountRate = resolveDiscountRate(input.directDiscountRate, warnings);

  const referralPrice = Math.round(marketGuestPrice * (1 - directDiscountRate));
  const referralReward = Math.round(referralPrice * referralCommissionRate);
  const referralOwnerNet = referralPrice - referralReward;
  const referralGuestSavings = marketGuestPrice - referralPrice;
  const referralOwnerGainVsAggregator = referralOwnerNet - rcNetPrice;

  let isReferralEconomicallyValid = true;

  if (referralPrice >= marketGuestPrice) {
    warnings.push("referral_price must be below market_guest_price");
    isReferralEconomicallyValid = false;
  }
  if (referralOwnerNet <= rcNetPrice) {
    warnings.push("referral_owner_net must exceed rc_net_price");
    isReferralEconomicallyValid = false;
  }
  if (referralReward <= 0) {
    warnings.push("referral_reward must be positive");
    isReferralEconomicallyValid = false;
  }
  if (referralGuestSavings <= 0) {
    warnings.push("referral_guest_savings must be positive");
    isReferralEconomicallyValid = false;
  }

  return {
    referralPrice,
    referralReward,
    referralOwnerNet,
    referralGuestSavings,
    referralOwnerGainVsAggregator,
    isReferralEconomicallyValid,
    warnings,
  };
}
