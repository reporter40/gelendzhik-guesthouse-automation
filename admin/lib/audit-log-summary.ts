/**
 * D2.5 — client-side audit log aggregation and filtering.
 */

import type { AuditLogEntry } from "@/lib/adminApi";
import {
  isManualReferralLeadAudit,
  isPropertyContextSettingsAudit,
} from "@/lib/audit-metadata";

export type AuditLogFilter = "all" | "referral_leads" | "property_context" | "other";

const AUDIT_FILTER_ALIASES: Record<string, AuditLogFilter> = {
  all: "all",
  referral: "referral_leads",
  referral_leads: "referral_leads",
  property_context: "property_context",
  other: "other",
};

/** D2.7 — parse ?auditFilter= from URL (invalid → all). */
export function parseAuditFilter(value: unknown): AuditLogFilter {
  if (value == null) return "all";
  const key = String(value).trim().toLowerCase();
  if (key === "") return "all";
  return AUDIT_FILTER_ALIASES[key] ?? "all";
}

/** D2.7 — canonical URL value for router.replace. */
export function auditFilterToUrlValue(filter: AuditLogFilter): string {
  if (filter === "referral_leads") return "referral";
  return filter;
}

/** D2.8 — scroll anchor target id (on page Section, not duplicated in table). */
export const AUDIT_LOG_SECTION_ID = "audit-log";

/** D2.8 — true when ?auditFilter is present (any value, including empty/invalid). */
export function shouldScrollToAuditLogFromSearchParams(
  searchParams: { has: (key: string) => boolean } | null | undefined,
): boolean {
  if (searchParams == null) return false;
  return searchParams.has("auditFilter");
}

export function getAuditLogScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "auto";
  return "smooth";
}

/** D2.8 — scroll to #audit-log (call from useEffect only). */
export function scrollToAuditLogAnchor(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(AUDIT_LOG_SECTION_ID);
  el?.scrollIntoView({ behavior: getAuditLogScrollBehavior(), block: "start" });
}

export type AuditLogSummary = {
  total: number;
  referralLeads: number;
  propertyContextChanges: number;
  other: number;
};

function safeEntries(entries: AuditLogEntry[] | null | undefined): AuditLogEntry[] {
  if (entries == null || !Array.isArray(entries)) return [];
  return entries;
}

export function buildAuditLogSummary(
  entries: AuditLogEntry[] | null | undefined,
): AuditLogSummary {
  const list = safeEntries(entries);
  let referralLeads = 0;
  let propertyContextChanges = 0;
  let other = 0;

  for (const entry of list) {
    if (isManualReferralLeadAudit(entry)) {
      referralLeads += 1;
    } else if (isPropertyContextSettingsAudit(entry)) {
      propertyContextChanges += 1;
    } else {
      other += 1;
    }
  }

  return {
    total: list.length,
    referralLeads,
    propertyContextChanges,
    other,
  };
}

export function filterAuditLogEntries(
  entries: AuditLogEntry[] | null | undefined,
  filter: AuditLogFilter,
): AuditLogEntry[] {
  const list = safeEntries(entries);
  if (filter === "all") return list;

  return list.filter((entry) => {
    if (filter === "referral_leads") return isManualReferralLeadAudit(entry);
    if (filter === "property_context") return isPropertyContextSettingsAudit(entry);
    return !isManualReferralLeadAudit(entry) && !isPropertyContextSettingsAudit(entry);
  });
}
