/**
 * D2.6 — export referral leads from audit log (client-side CSV/TSV).
 */

import type { AuditLogEntry } from "@/lib/adminApi";
import {
  isManualReferralLeadAudit,
  normalizeManualReferralLeadAuditMetadata,
} from "@/lib/audit-metadata";

export type ReferralLeadExportRow = {
  created_at: string;
  referrer: string;
  referrer_contact: string;
  referred_guest: string;
  referred_guest_contact: string;
  apartment_id: string;
  apartment_name: string;
  date_from: string;
  date_to: string;
  referral_price: string;
  referral_reward: string;
  referral_owner_net: string;
  referral_guest_savings: string;
  referral_owner_gain_vs_aggregator: string;
  notes: string;
};

export const REFERRAL_LEAD_EXPORT_COLUMNS: (keyof ReferralLeadExportRow)[] = [
  "created_at",
  "referrer",
  "referrer_contact",
  "referred_guest",
  "referred_guest_contact",
  "apartment_id",
  "apartment_name",
  "date_from",
  "date_to",
  "referral_price",
  "referral_reward",
  "referral_owner_net",
  "referral_guest_savings",
  "referral_owner_gain_vs_aggregator",
  "notes",
];

function safeEntries(entries: AuditLogEntry[] | null | undefined): AuditLogEntry[] {
  if (entries == null || !Array.isArray(entries)) return [];
  return entries;
}

function numCell(n: number | null): string {
  return n == null ? "" : String(n);
}

function sanitizeCellText(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

export function buildReferralLeadExportRows(
  entries: AuditLogEntry[] | null | undefined,
): ReferralLeadExportRow[] {
  const rows: ReferralLeadExportRow[] = [];

  for (const entry of safeEntries(entries)) {
    if (!isManualReferralLeadAudit(entry)) continue;

    const m = normalizeManualReferralLeadAuditMetadata(entry.metadata);
    const aptId =
      m.apartment_id ??
      (entry.apartment_id != null ? String(entry.apartment_id) : "");

    rows.push({
      created_at: entry.created_at ?? "",
      referrer: m.referrer_name ?? m.referrer_contact ?? "",
      referrer_contact: m.referrer_contact ?? "",
      referred_guest: m.referred_guest_name ?? m.referred_guest_contact ?? "",
      referred_guest_contact: m.referred_guest_contact ?? "",
      apartment_id: aptId,
      apartment_name: m.apartment_name ?? "",
      date_from: m.date_from ?? entry.date_from ?? "",
      date_to: m.date_to ?? entry.date_to ?? "",
      referral_price: numCell(m.referral_price),
      referral_reward: numCell(m.referral_reward),
      referral_owner_net: numCell(m.referral_owner_net),
      referral_guest_savings: numCell(m.referral_guest_savings),
      referral_owner_gain_vs_aggregator: numCell(m.referral_owner_gain_vs_aggregator),
      notes: sanitizeCellText(m.notes),
    });
  }

  return rows;
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToCells(row: ReferralLeadExportRow): string[] {
  return REFERRAL_LEAD_EXPORT_COLUMNS.map((col) => escapeCsvCell(row[col]));
}

export function referralLeadRowsToCsv(rows: ReferralLeadExportRow[]): string {
  const header = REFERRAL_LEAD_EXPORT_COLUMNS.join(",");
  const body = rows.map((row) => rowToCells(row).join(","));
  return [header, ...body].join("\n");
}

export function referralLeadRowsToTsv(rows: ReferralLeadExportRow[]): string {
  const header = REFERRAL_LEAD_EXPORT_COLUMNS.join("\t");
  const body = rows.map((row) =>
    REFERRAL_LEAD_EXPORT_COLUMNS.map((col) => sanitizeCellText(row[col])).join("\t"),
  );
  return [header, ...body].join("\n");
}

/** Filename: referral-leads-YYYY-MM-DD.csv (local date). */
export function referralLeadExportFilename(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `referral-leads-${y}-${m}-${d}.csv`;
}
