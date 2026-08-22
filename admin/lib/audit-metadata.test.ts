import { describe, expect, test } from "vitest";
import {
  isManualReferralLeadAudit,
  isPropertyContextSettingsAudit,
  MANUAL_REFERRAL_LEAD_AUDIT_ACTION,
  MANUAL_REFERRAL_LEAD_EVENT_TYPE,
  normalizeManualReferralLeadAuditMetadata,
  normalizePropertyContextAuditMetadata,
  PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION,
  summarizeManualReferralLeadAudit,
  summarizePropertyContextAudit,
} from "./audit-metadata";

describe("audit-metadata (D1.8)", () => {
  test("property_context_settings_save распознаётся", () => {
    expect(isPropertyContextSettingsAudit({ action: PROPERTY_CONTEXT_SETTINGS_AUDIT_ACTION })).toBe(true);
  });

  test("другие actions не PCS", () => {
    expect(isPropertyContextSettingsAudit({ action: "approve" })).toBe(false);
    expect(isPropertyContextSettingsAudit({ action: "export_rc_manual" })).toBe(false);
  });

  test("summary: added / changed / removed", () => {
    const n = normalizePropertyContextAuditMetadata({
      added_keys: ["51"],
      changed_keys: ["50"],
      removed_keys: ["49"],
      previous_default_property_context: null,
      next_default_property_context: "X",
      previous_size: 2,
      next_size: 2,
    });
    expect(summarizePropertyContextAudit(n)).toBe("Настройки контекста офферов изменены: +1 / ~1 / -1");
  });

  test("metadata null / undefined → fallback summary без счётчиков", () => {
    expect(summarizePropertyContextAudit(normalizePropertyContextAuditMetadata(null))).toBe(
      "Настройки контекста офферов изменены",
    );
    expect(summarizePropertyContextAudit(normalizePropertyContextAuditMetadata(undefined))).toBe(
      "Настройки контекста офферов изменены",
    );
  });

  test("повреждённая JSON-строка → без счётчиков", () => {
    const n = normalizePropertyContextAuditMetadata("{broken");
    expect(n.hadParsableEnvelope).toBe(false);
    expect(summarizePropertyContextAudit(n)).toBe("Настройки контекста офферов изменены");
  });

  test("массивы с не-string значениями нормализуются", () => {
    const n = normalizePropertyContextAuditMetadata({
      added_keys: ["a", 2, null, ""],
      changed_keys: [""],
      removed_keys: [50],
      previous_default_property_context: 1,
      next_default_property_context: "  ",
      previous_size: "3",
      next_size: 4,
    });
    expect(n.added_keys).toEqual(["a", "2"]);
    expect(n.changed_keys).toEqual([]);
    expect(n.removed_keys).toEqual(["50"]);
    expect(n.previous_default_property_context).toBe("1");
    expect(n.next_default_property_context).toBe(null);
    expect(n.previous_size).toBe(3);
    expect(n.next_size).toBe(4);
  });

  test("default contexts читаются как строки", () => {
    const n = normalizePropertyContextAuditMetadata({
      previous_default_property_context: " Old ",
      next_default_property_context: "New",
    });
    expect(n.previous_default_property_context).toBe("Old");
    expect(n.next_default_property_context).toBe("New");
  });

  test("raw объект без diff-полей даёт +0/~0/-0 но UI helper не ломается", () => {
    const n = normalizePropertyContextAuditMetadata({ event_type: "other_event" });
    expect(n.hadParsableEnvelope).toBe(true);
    expect(summarizePropertyContextAudit(n)).toBe("Настройки контекста офферов изменены: +0 / ~0 / -0");
  });

  test("same map только из sizes — счётчики по ключам 0", () => {
    const n = normalizePropertyContextAuditMetadata({
      added_keys: [],
      changed_keys: [],
      removed_keys: [],
      previous_size: 5,
      next_size: 5,
    });
    expect(summarizePropertyContextAudit(n)).toContain("+0 / ~0 / -0");
  });
});

describe("audit-metadata manual referral lead (D2.4)", () => {
  const fullMeta = {
    event_type: MANUAL_REFERRAL_LEAD_EVENT_TYPE,
    economics_available: true,
    referrer_name: "Мария",
    referred_guest_name: "Иван",
    apartment_name: "Акваторинг",
    date_from: "2026-07-15",
    date_to: "2026-07-17",
    referral_price: 9500,
    referral_reward: 475,
    referral_owner_net: 9025,
  };

  test("manual_referral_lead_logged action распознаётся", () => {
    expect(isManualReferralLeadAudit({ action: MANUAL_REFERRAL_LEAD_AUDIT_ACTION })).toBe(true);
  });

  test("metadata.event_type manual_referral_lead распознаётся", () => {
    expect(
      isManualReferralLeadAudit({
        action: "other",
        metadata: { event_type: MANUAL_REFERRAL_LEAD_EVENT_TYPE },
      }),
    ).toBe(true);
  });

  test("summary referrer → referred + reward", () => {
    const n = normalizeManualReferralLeadAuditMetadata(fullMeta);
    expect(summarizeManualReferralLeadAudit(n)).toBe(
      "Referral lead: Мария → Иван, reward 475 ₽ · Акваторинг · 2026-07-15—2026-07-17",
    );
  });

  test("fallback без reward", () => {
    const n = normalizeManualReferralLeadAuditMetadata({
      ...fullMeta,
      referral_reward: null,
      economics_available: false,
    });
    expect(summarizeManualReferralLeadAudit(n)).toBe(
      "Referral lead: Мария → Иван · Акваторинг · 2026-07-15—2026-07-17",
    );
  });

  test("fallback без имён использует бывший/новый гость", () => {
    const n = normalizeManualReferralLeadAuditMetadata({
      economics_available: true,
      referral_reward: 100,
    });
    expect(summarizeManualReferralLeadAudit(n)).toContain("бывший гость");
    expect(summarizeManualReferralLeadAudit(n)).toContain("новый гость");
  });

  test("bad/null metadata не падает", () => {
    expect(() => normalizeManualReferralLeadAuditMetadata(null)).not.toThrow();
    expect(summarizeManualReferralLeadAudit(normalizeManualReferralLeadAuditMetadata(null))).toBe(
      "Referral lead logged",
    );
    expect(summarizeManualReferralLeadAudit(normalizeManualReferralLeadAuditMetadata("{bad"))).toBe(
      "Referral lead logged",
    );
  });

  test("нечисловой referral_reward становится null", () => {
    const n = normalizeManualReferralLeadAuditMetadata({
      ...fullMeta,
      referral_reward: "oops",
    });
    expect(n.referral_reward).toBeNull();
    expect(summarizeManualReferralLeadAudit(n)).not.toContain("reward");
  });

  test("economics_available false скрывает economics numbers", () => {
    const n = normalizeManualReferralLeadAuditMetadata({
      ...fullMeta,
      economics_available: false,
    });
    expect(n.economics_available).toBe(false);
    expect(n.referral_price).toBeNull();
    expect(n.referral_owner_net).toBeNull();
    expect(n.referral_reward).toBe(475);
  });
});
