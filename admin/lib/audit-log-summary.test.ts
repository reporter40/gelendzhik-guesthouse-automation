import { describe, expect, test } from "vitest";
import type { AuditLogEntry } from "@/lib/adminApi";
import {
  auditFilterToUrlValue,
  buildAuditLogSummary,
  filterAuditLogEntries,
  parseAuditFilter,
  shouldScrollToAuditLogFromSearchParams,
} from "./audit-log-summary";
import {
  MANUAL_REFERRAL_LEAD_AUDIT_ACTION,
  PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION,
} from "./audit-metadata";

function entry(over: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "1",
    recommendation_id: null,
    action: "approve",
    previous_status: "draft",
    new_status: "approved",
    apartment_id: 50,
    date_from: "2026-07-15",
    date_to: "2026-07-17",
    old_price: null,
    new_price: 10000,
    reason: "test",
    actor: "admin",
    source: "admin_panel",
    created_at: "2026-07-20T12:00:00Z",
    ...over,
  };
}

const mixed: AuditLogEntry[] = [
  entry({ id: "a", action: "approve" }),
  entry({
    id: "b",
    action: MANUAL_REFERRAL_LEAD_AUDIT_ACTION,
    metadata: { event_type: "manual_referral_lead" },
  }),
  entry({ id: "c", action: PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION }),
  entry({
    id: "d",
    action: MANUAL_REFERRAL_LEAD_AUDIT_ACTION,
    metadata: { event_type: "manual_referral_lead", referrer_name: "X" },
  }),
];

describe("audit-log-summary (D2.5)", () => {
  test("buildAuditLogSummary counts total and categories", () => {
    const s = buildAuditLogSummary(mixed);
    expect(s.total).toBe(4);
    expect(s.referralLeads).toBe(2);
    expect(s.propertyContextChanges).toBe(1);
    expect(s.other).toBe(1);
  });

  test("null/undefined input does not throw", () => {
    expect(buildAuditLogSummary(null)).toEqual({
      total: 0,
      referralLeads: 0,
      propertyContextChanges: 0,
      other: 0,
    });
    expect(buildAuditLogSummary(undefined).total).toBe(0);
    expect(filterAuditLogEntries(null, "all")).toEqual([]);
  });

  test('filter "all" returns all entries', () => {
    expect(filterAuditLogEntries(mixed, "all")).toHaveLength(4);
  });

  test('filter "referral_leads" returns only MRL', () => {
    const f = filterAuditLogEntries(mixed, "referral_leads");
    expect(f).toHaveLength(2);
    expect(f.every((e) => e.action === MANUAL_REFERRAL_LEAD_AUDIT_ACTION)).toBe(true);
  });

  test('filter "property_context" returns only PCS', () => {
    const f = filterAuditLogEntries(mixed, "property_context");
    expect(f).toHaveLength(1);
    expect(f[0].action).toBe(PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION);
  });

  test('filter "other" excludes PCS and MRL', () => {
    const f = filterAuditLogEntries(mixed, "other");
    expect(f).toHaveLength(1);
    expect(f[0].action).toBe("approve");
  });
});

describe("audit-log-summary deep link (D2.7)", () => {
  test("parse null/empty → all", () => {
    expect(parseAuditFilter(null)).toBe("all");
    expect(parseAuditFilter(undefined)).toBe("all");
    expect(parseAuditFilter("")).toBe("all");
  });

  test("parse referral aliases", () => {
    expect(parseAuditFilter("referral")).toBe("referral_leads");
    expect(parseAuditFilter("referral_leads")).toBe("referral_leads");
  });

  test("parse property_context and other", () => {
    expect(parseAuditFilter("property_context")).toBe("property_context");
    expect(parseAuditFilter("other")).toBe("other");
  });

  test("parse unknown → all", () => {
    expect(parseAuditFilter("unknown")).toBe("all");
    expect(parseAuditFilter("crm")).toBe("all");
  });

  test("auditFilterToUrlValue", () => {
    expect(auditFilterToUrlValue("referral_leads")).toBe("referral");
    expect(auditFilterToUrlValue("all")).toBe("all");
    expect(auditFilterToUrlValue("property_context")).toBe("property_context");
    expect(auditFilterToUrlValue("other")).toBe("other");
  });
});

describe("audit deep-link scroll (D2.8)", () => {
  function mockParams(entries: [string, string][]) {
    const map = new Map(entries);
    return {
      has: (key: string) => map.has(key),
      get: (key: string) => map.get(key) ?? null,
    };
  }

  test("auditFilter absent → no scroll", () => {
    expect(shouldScrollToAuditLogFromSearchParams(mockParams([]))).toBe(false);
    expect(shouldScrollToAuditLogFromSearchParams(null)).toBe(false);
  });

  test("auditFilter=referral → scroll", () => {
    expect(shouldScrollToAuditLogFromSearchParams(mockParams([["auditFilter", "referral"]]))).toBe(
      true,
    );
  });

  test("auditFilter=unknown → scroll", () => {
    expect(shouldScrollToAuditLogFromSearchParams(mockParams([["auditFilter", "unknown"]]))).toBe(
      true,
    );
  });

  test("auditFilter empty string param present → scroll", () => {
    expect(shouldScrollToAuditLogFromSearchParams(mockParams([["auditFilter", ""]]))).toBe(true);
  });
});
