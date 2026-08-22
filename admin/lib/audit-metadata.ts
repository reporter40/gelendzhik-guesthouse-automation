/**
 * D1.8 — безопасный разбор metadata для audit property_context_settings_save.
 * D2.4 — manual_referral_lead_logged viewer helpers.
 */

import type { AuditLogEntry } from "@/lib/adminApi";

export const PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION = "property_context_settings_save";
export const MANUAL_REFERRAL_LEAD_AUDIT_ACTION = "manual_referral_lead_logged";
export const MANUAL_REFERRAL_LEAD_EVENT_TYPE = "manual_referral_lead";

const RU_LOCALE = "ru-RU";

function parseMetadataObject(metadata: unknown): Record<string, unknown> | null {
  if (metadata === undefined || metadata === null) return null;
  if (typeof metadata === "string") {
    try {
      const p = JSON.parse(metadata) as unknown;
      if (p !== null && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

function boolOrFalse(v: unknown): boolean {
  return v === true || v === "true";
}

function fmtRubAmount(n: number): string {
  return `${Math.round(n).toLocaleString(RU_LOCALE)} ₽`;
}

export function isPropertyContextSettingsAudit(entry: Pick<AuditLogEntry, "action">): boolean {
  return entry.action === PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION;
}

export type NormalizedPropertyContextAuditMeta = {
  /** metadata удалён, null или не объект / JSON parse failed */
  hadParsableEnvelope: boolean;
  added_keys: string[];
  changed_keys: string[];
  removed_keys: string[];
  previous_default_property_context: string | null;
  next_default_property_context: string | null;
  previous_size: number | null;
  next_size: number | null;
  /** объект после успешного разбора; иначе null */
  rawObject: Record<string, unknown> | null;
};

export function summarizePropertyContextAudit(normalized: NormalizedPropertyContextAuditMeta): string {
  const BASE = "Настройки контекста офферов изменены";
  if (!normalized.hadParsableEnvelope) {
    return BASE;
  }
  const a = normalized.added_keys.length;
  const c = normalized.changed_keys.length;
  const r = normalized.removed_keys.length;
  return `${BASE}: +${a} / ~${c} / -${r}`;
}

/** Нормализует массивы строк, числа размеров, default context; не бросает. */
export function normalizePropertyContextAuditMetadata(metadata: unknown): NormalizedPropertyContextAuditMeta {
  const emptyFields = (): Omit<NormalizedPropertyContextAuditMeta, "hadParsableEnvelope" | "rawObject"> => ({
    added_keys: [],
    changed_keys: [],
    removed_keys: [],
    previous_default_property_context: null,
    next_default_property_context: null,
    previous_size: null,
    next_size: null,
  });

  const obj = parseMetadataObject(metadata);
  if (!obj) {
    return { ...emptyFields(), hadParsableEnvelope: false, rawObject: null };
  }

  const strArr = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) {
      if (x == null) continue;
      const s = String(x).trim();
      if (s) out.push(s);
    }
    return out;
  };

  const numOrNull = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  return {
    hadParsableEnvelope: true,
    added_keys: strArr(obj.added_keys),
    changed_keys: strArr(obj.changed_keys),
    removed_keys: strArr(obj.removed_keys),
    previous_default_property_context: strOrNull(obj.previous_default_property_context),
    next_default_property_context: strOrNull(obj.next_default_property_context),
    previous_size: numOrNull(obj.previous_size),
    next_size: numOrNull(obj.next_size),
    rawObject: obj,
  };
}

export type NormalizedManualReferralLeadAuditMeta = {
  hadParsableEnvelope: boolean;
  referrer_name: string | null;
  referrer_contact: string | null;
  referred_guest_name: string | null;
  referred_guest_contact: string | null;
  apartment_id: string | null;
  apartment_name: string | null;
  date_from: string | null;
  date_to: string | null;
  economics_available: boolean;
  referral_price: number | null;
  referral_reward: number | null;
  referral_owner_net: number | null;
  referral_guest_savings: number | null;
  referral_owner_gain_vs_aggregator: number | null;
  notes: string | null;
  rawObject: Record<string, unknown> | null;
};

export function isManualReferralLeadAudit(
  entry: Pick<AuditLogEntry, "action" | "metadata">,
): boolean {
  if (entry.action === MANUAL_REFERRAL_LEAD_AUDIT_ACTION) return true;
  const obj = parseMetadataObject(entry.metadata);
  return obj?.event_type === MANUAL_REFERRAL_LEAD_EVENT_TYPE;
}

export function normalizeManualReferralLeadAuditMetadata(
  metadata: unknown,
): NormalizedManualReferralLeadAuditMeta {
  const empty: NormalizedManualReferralLeadAuditMeta = {
    hadParsableEnvelope: false,
    referrer_name: null,
    referrer_contact: null,
    referred_guest_name: null,
    referred_guest_contact: null,
    apartment_id: null,
    apartment_name: null,
    date_from: null,
    date_to: null,
    economics_available: false,
    referral_price: null,
    referral_reward: null,
    referral_owner_net: null,
    referral_guest_savings: null,
    referral_owner_gain_vs_aggregator: null,
    notes: null,
    rawObject: null,
  };

  const obj = parseMetadataObject(metadata);
  if (!obj) return empty;

  const economics_available = boolOrFalse(obj.economics_available);

  return {
    hadParsableEnvelope: true,
    referrer_name: strOrNull(obj.referrer_name),
    referrer_contact: strOrNull(obj.referrer_contact),
    referred_guest_name: strOrNull(obj.referred_guest_name),
    referred_guest_contact: strOrNull(obj.referred_guest_contact),
    apartment_id: strOrNull(obj.apartment_id),
    apartment_name: strOrNull(obj.apartment_name),
    date_from: strOrNull(obj.date_from),
    date_to: strOrNull(obj.date_to),
    economics_available,
    referral_price: economics_available ? numOrNull(obj.referral_price) : null,
    referral_reward: numOrNull(obj.referral_reward),
    referral_owner_net: economics_available ? numOrNull(obj.referral_owner_net) : null,
    referral_guest_savings: economics_available ? numOrNull(obj.referral_guest_savings) : null,
    referral_owner_gain_vs_aggregator: economics_available
      ? numOrNull(obj.referral_owner_gain_vs_aggregator)
      : null,
    notes: strOrNull(obj.notes),
    rawObject: obj,
  };
}

export function summarizeManualReferralLeadAudit(
  normalized: NormalizedManualReferralLeadAuditMeta,
): string {
  if (!normalized.hadParsableEnvelope) {
    return "Referral lead logged";
  }

  const referrer =
    normalized.referrer_name ?? normalized.referrer_contact ?? "бывший гость";
  const referred =
    normalized.referred_guest_name ??
    normalized.referred_guest_contact ??
    "новый гость";

  let summary =
    normalized.referral_reward != null
      ? `Referral lead: ${referrer} → ${referred}, reward ${fmtRubAmount(normalized.referral_reward)}`
      : `Referral lead: ${referrer} → ${referred}`;

  if (normalized.apartment_name) {
    summary += ` · ${normalized.apartment_name}`;
  }
  if (normalized.date_from && normalized.date_to) {
    summary += ` · ${normalized.date_from}—${normalized.date_to}`;
  }

  return summary;
}
