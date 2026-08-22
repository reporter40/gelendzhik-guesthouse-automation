/**
 * D1.3 — маппинг revenue-строки → DirectOfferInput (без знания UI).
 */

import type { PricingRecommendation } from "@/lib/adminApi";
import type { DirectOfferInput } from "@/lib/direct-offer-generator";
import { computeNightsBetween } from "@/lib/direct-offer-generator";
import type { DirectOfferSettings } from "@/lib/direct-offer-settings";

/** Поля только из строки рекомендации (без шаблонных полей D1.2). preset задаётся только в UI (D1.9). */
export type DirectOfferRowBase = Omit<
  DirectOfferInput,
  "bookingInstruction" | "contactName" | "contactPhone" | "propertyName" | "preset"
>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoStayDate(value: unknown): value is string {
  return typeof value === "string" && ISO.test(value.trim());
}

/** Нормализация дат/ночей из строки API. */
export function normalizeStayFieldsFromRow(row: PricingRecommendation): {
  checkIn: string;
  checkOut: string;
  nights: number | null;
} {
  const rawIn = typeof row.date_from === "string" ? row.date_from.trim() : "";
  const rawOut = typeof row.date_to === "string" ? row.date_to.trim() : "";
  const checkIn = isIsoStayDate(rawIn) ? rawIn.trim() : "";
  const checkOut = isIsoStayDate(rawOut) ? rawOut.trim() : "";

  let nights: number | null = null;
  if (typeof row.nights === "number" && Number.isFinite(row.nights) && row.nights >= 1) {
    nights = Math.round(row.nights);
  } else if (checkIn && checkOut) {
    nights = computeNightsBetween(checkIn, checkOut);
  }

  return { checkIn, checkOut, nights };
}

/** Название объекта для гостя — только из строки рекомендации. */
export function rowUnitDisplayName(row: PricingRecommendation): string {
  const name = typeof row.apartment_name === "string" ? row.apartment_name.trim() : "";
  if (name) return name;
  const id =
    row.apartment_id != null && String(row.apartment_id).trim()
      ? String(row.apartment_id).trim()
      : "";
  if (id) return `Объект №${id}`;
  return "Объект";
}

function mapFiniteNumber(n: unknown): number | null {
  if (n == null) return null;
  if (typeof n === "number" && Number.isFinite(n)) return n;
  return null;
}

export function rowPropertyContextFallback(row: PricingRecommendation): string {
  const p = row.property_context;
  if (typeof p === "string" && p.trim()) return p.trim();
  return "";
}

/**
 * Данные строки и цены из API/БД — без пересчёта прайсинга.
 */
export function buildDirectOfferRowBase(row: PricingRecommendation): DirectOfferRowBase | null {
  const dp = row.direct_price;
  if (dp == null || typeof dp !== "number" || !Number.isFinite(dp) || !(dp > 0)) {
    return null;
  }

  const { checkIn, checkOut, nights } = normalizeStayFieldsFromRow(row);

  const guestFacingPrice =
    mapFiniteNumber(row.expected_aggregator_guest_price) ??
    mapFiniteNumber(row.recommended_guest_price) ??
    mapFiniteNumber(row.recommended_price);

  return {
    unitName: rowUnitDisplayName(row),
    checkIn,
    checkOut,
    nights,
    directPrice: dp,
    guestSavings: mapFiniteNumber(row.direct_savings_for_guest),
    ownerGain: mapFiniteNumber(row.direct_owner_gain),
    marketPrice: row.market_median ?? null,
    guestFacingPrice,
  };
}

/**
 * Сборка полного input: строка рекомендации + локальный шаблон (D1.2).
 * propertyName: сначала из шаблона, иначе property_context строки.
 */
export function buildDirectOfferInputFromRecommendation(
  row: PricingRecommendation,
  template: DirectOfferSettings,
): DirectOfferInput | null {
  const base = buildDirectOfferRowBase(row);
  if (!base) return null;

  const tplProp = template.propertyName.trim();
  const rowProp = rowPropertyContextFallback(row);
  const propertyName = tplProp || rowProp || null;

  const biRaw = template.bookingInstruction;
  const bookingInstruction = biRaw.trim() ? biRaw : null;
  const cn = template.contactName.trim();
  const cp = template.contactPhone.trim();

  return {
    ...base,
    bookingInstruction,
    contactName: cn ? cn : null,
    contactPhone: cp ? cp : null,
    propertyName,
  };
}
