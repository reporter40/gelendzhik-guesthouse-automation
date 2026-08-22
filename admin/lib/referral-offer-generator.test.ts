import { describe, expect, test } from "vitest";
import {
  DEFAULT_REFERRAL_BOOKING_INSTRUCTION,
  formatReferralRewardPercent,
  generateReferralOffer,
} from "./referral-offer-generator";

const URL_RE = /https?:\/\//i;
const LINK_PLACEHOLDER_RE = /\[(ссылка|link|url)\]/i;

describe("generateReferralOffer (D2.2)", () => {
  test("default rate is 5%", () => {
    const t = generateReferralOffer({ unitName: "Студия" });
    expect(t.telegramText).toContain("5%");
    expect(t.shortText).toContain("5%");
  });

  test("custom rate formats correctly", () => {
    const t = generateReferralOffer({
      unitName: "Дом",
      referralRewardRate: 0.1,
    });
    expect(formatReferralRewardPercent(0.1)).toBe("10%");
    expect(t.telegramText).toContain("10%");
  });

  test("telegramText contains recommendation idea and percent", () => {
    const t = generateReferralOffer({ propertyName: "Акваторинг" });
    expect(t.telegramText).toMatch(/порекомендуете|рекомендац/i);
    expect(t.telegramText).toContain("5%");
  });

  test("whatsappText is shorter than telegramText", () => {
    const t = generateReferralOffer({
      propertyName: "Акваторинг",
      exampleBookingAmount: 20000,
    });
    expect(t.whatsappText.length).toBeLessThan(t.telegramText.length);
  });

  test("exampleBookingAmount 20000 yields reward 1000", () => {
    const t = generateReferralOffer({ exampleBookingAmount: 20000 });
    expect(t.telegramText).toContain("20");
    expect(t.telegramText).toContain("000");
    expect(t.telegramText).toContain("1");
    expect(t.telegramText).toMatch(/1[\s\u00a0]?000/);
  });

  test("exampleReward override is used", () => {
    const t = generateReferralOffer({
      exampleBookingAmount: 20000,
      exampleReward: 1500,
    });
    expect(t.telegramText).toContain("1");
    expect(t.telegramText).toMatch(/1[\s\u00a0]?500/);
    expect(t.telegramText).not.toMatch(/1[\s\u00a0]?000/);
  });

  test("without exampleBookingAmount no invented sum", () => {
    const t = generateReferralOffer({ unitName: "Студия" });
    expect(t.telegramText).not.toMatch(/Например, при бронировании/i);
    expect(t.whatsappText).not.toMatch(/Например, при бронировании/i);
  });

  test("contactName and contactPhone appended when present", () => {
    const t = generateReferralOffer({
      contactName: "Анна",
      contactPhone: "+7 900 000-00-00",
    });
    expect(t.telegramText).toContain("Контакт: Анна, +7 900 000-00-00");
  });

  test("empty contacts are omitted", () => {
    const t = generateReferralOffer({
      contactName: "  ",
      contactPhone: null,
    });
    expect(t.telegramText).not.toContain("Контакт:");
  });

  test("default bookingInstruction when missing", () => {
    const t = generateReferralOffer({});
    expect(t.telegramText).toContain(DEFAULT_REFERRAL_BOOKING_INSTRUCTION);
  });

  test("custom bookingInstruction when provided", () => {
    const custom = "Свяжитесь в Telegram @host.";
    const t = generateReferralOffer({ bookingInstruction: custom });
    expect(t.telegramText).toContain(custom);
    expect(t.telegramText).not.toContain(DEFAULT_REFERRAL_BOOKING_INSTRUCTION);
  });

  test("does not contain guaranteed wording or URLs", () => {
    const t = generateReferralOffer({
      exampleBookingAmount: 15000,
      propertyName: "Тест",
    });
    for (const body of [t.telegramText, t.whatsappText, t.shortText]) {
      expect(body.toLowerCase()).not.toContain("гарантированно");
      expect(body).not.toMatch(URL_RE);
      expect(body).not.toMatch(LINK_PLACEHOLDER_RE);
    }
  });

  test("shortText includes place name when propertyName set", () => {
    const t = generateReferralOffer({ propertyName: "Акваторинг" });
    expect(t.shortText).toContain("Акваторинг");
    expect(t.shortText).toContain("5%");
  });
});
