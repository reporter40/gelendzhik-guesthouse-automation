import { describe, expect, test } from "vitest";
import type { AuditLogEntry } from "@/lib/adminApi";
import {
  buildReferralLeadExportRows,
  escapeCsvCell,
  referralLeadRowsToCsv,
  referralLeadRowsToTsv,
  REFERRAL_LEAD_EXPORT_COLUMNS,
} from "./referral-lead-export";
import { MANUAL_REFERRAL_LEAD_AUDIT_ACTION } from "./audit-metadata";

function entry(over: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "1",
    recommendation_id: null,
    action: MANUAL_REFERRAL_LEAD_AUDIT_ACTION,
    previous_status: null,
    new_status: null,
    apartment_id: 50,
    date_from: "2026-07-15",
    date_to: "2026-07-17",
    old_price: null,
    new_price: null,
    reason: "manual_referral_lead_logged",
    actor: "admin_api",
    source: "admin_panel",
    created_at: "2026-07-20T10:00:00Z",
    metadata: {
      event_type: "manual_referral_lead",
      economics_available: true,
      referrer_name: "Мария",
      referrer_contact: "+7900",
      referred_guest_name: "Иван",
      referral_price: 9500,
      referral_reward: 475,
      referral_owner_net: 9025,
      apartment_name: "Акваторинг",
      notes: "ok",
    },
    ...over,
  };
}

describe("referral-lead-export (D2.6)", () => {
  test("builds rows only for referral lead entries", () => {
    const rows = buildReferralLeadExportRows([
      entry(),
      entry({ id: "2", action: "approve", metadata: null }),
      entry({ id: "3", action: "property_context_settings_save", metadata: {} }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].referrer).toBe("Мария");
  });

  test("referrer and referred fallback name/contact", () => {
    const rows = buildReferralLeadExportRows([
      entry({
        metadata: {
          event_type: "manual_referral_lead",
          referrer_contact: "ref@mail",
          referred_guest_contact: "+7999",
        },
      }),
    ]);
    expect(rows[0].referrer).toBe("ref@mail");
    expect(rows[0].referred_guest).toBe("+7999");
  });

  test("reward/price numbers in rows without ruble sign", () => {
    const rows = buildReferralLeadExportRows([entry()]);
    expect(rows[0].referral_price).toBe("9500");
    expect(rows[0].referral_reward).toBe("475");
    expect(rows[0].referral_owner_net).toBe("9025");
  });

  test("notes with comma and quote escaped in CSV", () => {
    const rows = buildReferralLeadExportRows([
      entry({ metadata: { event_type: "manual_referral_lead", notes: 'say "hi", team' } }),
    ]);
    const csv = referralLeadRowsToCsv(rows);
    expect(csv).toContain(escapeCsvCell('say "hi", team'));
  });

  test("TSV has tab-separated header", () => {
    const tsv = referralLeadRowsToTsv([]);
    expect(tsv.split("\n")[0]).toBe(REFERRAL_LEAD_EXPORT_COLUMNS.join("\t"));
  });

  test("empty input returns header-only CSV and TSV", () => {
    expect(referralLeadRowsToCsv([])).toBe(REFERRAL_LEAD_EXPORT_COLUMNS.join(","));
    expect(referralLeadRowsToTsv([])).toBe(REFERRAL_LEAD_EXPORT_COLUMNS.join("\t"));
  });

  test("bad metadata does not throw", () => {
    expect(() =>
      buildReferralLeadExportRows([
        entry({ metadata: null }),
        entry({ metadata: "{broken" as unknown as Record<string, unknown> }),
      ]),
    ).not.toThrow();
    const rows = buildReferralLeadExportRows([entry({ metadata: null })]);
    expect(rows[0].referrer).toBe("");
  });

  test("null entries input returns empty rows but header in csv helper", () => {
    expect(buildReferralLeadExportRows(null)).toEqual([]);
    expect(referralLeadRowsToCsv(buildReferralLeadExportRows(null))).toContain("created_at");
  });
});
