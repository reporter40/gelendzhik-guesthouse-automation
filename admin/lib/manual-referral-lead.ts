/**
 * D2.3 — normalize / validate / metadata for manual referral lead audit rows.
 */

import type { PricingRecommendation } from "@/lib/adminApi";
import { computeReferralEconomicsFromRecommendation } from "@/lib/referral-economics-from-recommendation";

export type ManualReferralLeadRawInput = {
  apartment_id?: string | number | null;
  apartment_name?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  referrer_name?: string | null;
  referrer_contact?: string | null;
  referred_guest_name?: string | null;
  referred_guest_contact?: string | null;
  referral_price?: number | null;
  referral_reward?: number | null;
  referral_owner_net?: number | null;
  referral_guest_savings?: number | null;
  referral_owner_gain_vs_aggregator?: number | null;
  notes?: string | null;
};

export type ManualReferralLeadInput = {
  apartment_id: string | null;
  apartment_name: string | null;
  date_from: string | null;
  date_to: string | null;
  referrer_name: string | null;
  referrer_contact: string | null;
  referred_guest_name: string | null;
  referred_guest_contact: string | null;
  referral_price: number | null;
  referral_reward: number | null;
  referral_owner_net: number | null;
  referral_guest_savings: number | null;
  referral_owner_gain_vs_aggregator: number | null;
  notes: string | null;
};

export type ManualReferralLeadValidationResult =
  | { ok: true; value: ManualReferralLeadInput }
  | { ok: false; error: string };

function trimString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function mapPositiveNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function normalizeManualReferralLeadInput(
  raw: ManualReferralLeadRawInput,
): ManualReferralLeadInput {
  const aptRaw = raw.apartment_id;
  const apartment_id =
    aptRaw == null || String(aptRaw).trim() === "" ? null : String(aptRaw).trim();

  return {
    apartment_id,
    apartment_name: trimString(raw.apartment_name),
    date_from: trimString(raw.date_from),
    date_to: trimString(raw.date_to),
    referrer_name: trimString(raw.referrer_name),
    referrer_contact: trimString(raw.referrer_contact),
    referred_guest_name: trimString(raw.referred_guest_name),
    referred_guest_contact: trimString(raw.referred_guest_contact),
    referral_price: mapPositiveNumber(raw.referral_price),
    referral_reward: mapPositiveNumber(raw.referral_reward),
    referral_owner_net: mapPositiveNumber(raw.referral_owner_net),
    referral_guest_savings: mapPositiveNumber(raw.referral_guest_savings),
    referral_owner_gain_vs_aggregator: mapPositiveNumber(
      raw.referral_owner_gain_vs_aggregator,
    ),
    notes: trimString(raw.notes),
  };
}

export function validateManualReferralLeadInput(
  input: ManualReferralLeadInput,
): ManualReferralLeadValidationResult {
  if (!input.referrer_name && !input.referrer_contact) {
    return { ok: false, error: "Укажите имя или контакт рекомендующего гостя" };
  }
  if (!input.referred_guest_name && !input.referred_guest_contact) {
    return { ok: false, error: "Укажите имя или контакт рекомендуемого гостя" };
  }
  if (
    input.referral_reward != null &&
    (typeof input.referral_reward !== "number" ||
      !Number.isFinite(input.referral_reward) ||
      input.referral_reward < 0)
  ) {
    return { ok: false, error: "referral_reward must be a non-negative number" };
  }
  return { ok: true, value: input };
}

export function economicsAvailableFromLeadInput(input: ManualReferralLeadInput): boolean {
  return input.referral_price != null && input.referral_reward != null;
}

export function buildManualReferralLeadMetadata(
  input: ManualReferralLeadInput,
): Record<string, unknown> {
  const economics_available = economicsAvailableFromLeadInput(input);
  const meta: Record<string, unknown> = {
    event_type: "manual_referral_lead",
    economics_available,
    apartment_id: input.apartment_id,
    apartment_name: input.apartment_name,
    date_from: input.date_from,
    date_to: input.date_to,
    referrer_name: input.referrer_name,
    referrer_contact: input.referrer_contact,
    referred_guest_name: input.referred_guest_name,
    referred_guest_contact: input.referred_guest_contact,
    notes: input.notes,
  };

  if (economics_available) {
    meta.referral_price = input.referral_price;
    meta.referral_reward = input.referral_reward;
    if (input.referral_owner_net != null) meta.referral_owner_net = input.referral_owner_net;
    if (input.referral_guest_savings != null) {
      meta.referral_guest_savings = input.referral_guest_savings;
    }
    if (input.referral_owner_gain_vs_aggregator != null) {
      meta.referral_owner_gain_vs_aggregator = input.referral_owner_gain_vs_aggregator;
    }
  }

  return meta;
}

/** Prefill hidden economics + row context from recommendation (D2.1). */
export function buildManualReferralLeadPrefillFromRecommendation(
  row: PricingRecommendation,
): ManualReferralLeadRawInput {
  const state = computeReferralEconomicsFromRecommendation(row);
  const base: ManualReferralLeadRawInput = {
    apartment_id: row.apartment_id,
    apartment_name: row.apartment_name ?? null,
    date_from: row.date_from ?? null,
    date_to: row.date_to ?? null,
  };

  if (!state.hasRequiredInputs || !state.result.isReferralEconomicallyValid) {
    return base;
  }

  const { result } = state;
  return {
    ...base,
    referral_price: result.referralPrice,
    referral_reward: result.referralReward,
    referral_owner_net: result.referralOwnerNet,
    referral_guest_savings: result.referralGuestSavings,
    referral_owner_gain_vs_aggregator: result.referralOwnerGainVsAggregator,
  };
}

export function prepareManualReferralLeadForSave(
  raw: ManualReferralLeadRawInput,
): ManualReferralLeadValidationResult {
  if (raw.referral_reward != null && raw.referral_reward !== ("" as unknown)) {
    const n = Number(raw.referral_reward);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "referral_reward must be a non-negative number" };
    }
  }
  const normalized = normalizeManualReferralLeadInput(raw);
  return validateManualReferralLeadInput(normalized);
}
