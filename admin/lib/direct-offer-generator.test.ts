import { describe, expect, test } from "vitest";
import {
  computeNightsBetween,
  DEFAULT_BOOKING_INSTRUCTION,
  fmtRub,
  formatOfferDate,
  formatContactLine,
  generateDirectOffer,
  nightsWord,
  resolveBookingClosing,
  type DirectOfferInput,
} from "./direct-offer-generator";

describe("fmtRub", () => {
  test("formats integer with ru locale and ruble sign", () => {
    expect(fmtRub(10230)).toMatch(/10[.\s\u00a0]?230/u);
    expect(fmtRub(10230)).toContain("₽");
  });
});

describe("formatOfferDate", () => {
  test("converts ISO to DD.MM.YYYY", () => {
    expect(formatOfferDate("2026-07-15")).toBe("15.07.2026");
  });
});

describe("computeNightsBetween", () => {
  test("counts nights like pricing_recommendations", () => {
    expect(computeNightsBetween("2026-07-15", "2026-07-17")).toBe(2);
    expect(computeNightsBetween("2026-07-24", "2026-07-25")).toBe(1);
  });
});

describe("nightsWord", () => {
  test("1/2/5/11/21/22", () => {
    expect(nightsWord(1)).toBe("ночь");
    expect(nightsWord(2)).toBe("ночи");
    expect(nightsWord(5)).toBe("ночей");
    expect(nightsWord(11)).toBe("ночей");
    expect(nightsWord(21)).toBe("ночь");
    expect(nightsWord(22)).toBe("ночи");
  });
});

describe("resolveBookingClosing & formatContactLine", () => {
  test("uses default booking when instruction missing or blank", () => {
    expect(resolveBookingClosing({} as DirectOfferInput)).toBe(DEFAULT_BOOKING_INSTRUCTION);
    const input: Partial<DirectOfferInput> = { bookingInstruction: "  " };
    expect(resolveBookingClosing(input as DirectOfferInput)).toBe(DEFAULT_BOOKING_INSTRUCTION);
  });

  test("uses custom booking when non-empty", () => {
    const custom = "Позвоните для фиксации до 18:00.";
    expect(
      resolveBookingClosing({ bookingInstruction: custom } as DirectOfferInput),
    ).toBe(custom);
  });

  test("formatContactLine skips empty strings", () => {
    expect(
      formatContactLine({
        contactName: "",
        contactPhone: "   ",
      } as DirectOfferInput),
    ).toBeNull();
  });
});

describe("generateDirectOffer", () => {
  const base: DirectOfferInput = {
    unitName: "Квартира тест",
    checkIn: "2026-07-15",
    checkOut: "2026-07-17",
    nights: 2,
    directPrice: 9719,
    guestSavings: 510,
    ownerGain: 1050,
    guestFacingPrice: 10229,
  };

  test("does not throw when ownerGain is missing", () => {
    const { ownerGain: _, ...noOwner } = base;
    expect(() => generateDirectOffer({ ...noOwner, ownerGain: undefined })).not.toThrow();
    const t = generateDirectOffer({ ...noOwner, ownerGain: null });
    expect(t.telegramText).toContain("Здравствуйте!");
  });

  test("shortText includes direct price and guest savings when savings > 0", () => {
    const t = generateDirectOffer(base);
    const compact = t.shortText.replace(/\s/g, "");
    expect(compact).toContain("9719");
    expect(compact).toContain("510");
    expect(t.shortText.toLowerCase()).toContain("экономия");
  });

  test("uses computed nights when nights omitted", () => {
    const t = generateDirectOffer({
      ...base,
      nights: undefined,
    });
    expect(t.telegramText).toContain("2 ночи");
  });

  test("D1.1: telegram and whatsapp texts differ in structure", () => {
    const t = generateDirectOffer(base);
    expect(t.telegramText).not.toBe(t.whatsappText);
    expect((t.telegramText.match(/\n/g) ?? []).length).toBeGreaterThan(
      (t.whatsappText.match(/\n/g) ?? []).length,
    );
  });

  test("D1.1: custom bookingInstruction appears in telegram and whatsapp", () => {
    const custom = "Напишите «бронь» в ответ, и мы отправим реквизиты.";
    const t = generateDirectOffer({ ...base, bookingInstruction: custom });
    expect(t.telegramText).toContain(custom);
    expect(t.whatsappText).toContain(custom);
    expect(t.telegramText).not.toContain(DEFAULT_BOOKING_INSTRUCTION);
  });

  test("D1.1: default booking instruction without custom", () => {
    const t = generateDirectOffer({ ...base, bookingInstruction: null });
    expect(t.telegramText).toContain(DEFAULT_BOOKING_INSTRUCTION);
    expect(t.whatsappText).toContain(DEFAULT_BOOKING_INSTRUCTION);
  });

  test("D1.1: contact lines only when name or phone set", () => {
    const withContact = generateDirectOffer({
      ...base,
      contactName: "Марина",
      contactPhone: "+79001234567",
    });
    expect(withContact.telegramText).toContain("Марина");
    expect(withContact.telegramText).toContain("+79001234567");
    expect(withContact.telegramText).toContain("Контакт:");

    const noContact = generateDirectOffer({
      ...base,
      contactName: "  ",
      contactPhone: null,
    });
    expect(noContact.telegramText).not.toContain("Контакт:");
  });

  test("D1.1: propertyName present when passed", () => {
    const t = generateDirectOffer({ ...base, propertyName: "Дом у моря" });
    expect(t.telegramText).toContain("Дом у моря");
    expect(t.shortText).toContain("Дом у моря");
  });

  test("D1.1: shortText stays shorter than telegram and carries directPrice", () => {
    const t = generateDirectOffer(base);
    expect(t.shortText.length).toBeLessThan(t.telegramText.length);
    expect(t.shortText.replace(/\s/g, "")).toContain("9719");
  });

  test("D1.1: guest savings omitted when absent or <= 0", () => {
    const noSave = generateDirectOffer({ ...base, guestSavings: null });
    expect(noSave.shortText.toLowerCase()).not.toContain("экономия");

    const zero = generateDirectOffer({ ...base, guestSavings: 0 });
    expect(zero.shortText.toLowerCase()).not.toContain("экономия");
    expect(zero.telegramText.toLowerCase()).not.toContain("экономия для вас примерно");
  });
});

describe("generateDirectOffer presets (D1.9)", () => {
  const base: DirectOfferInput = {
    unitName: "Квартира тест",
    checkIn: "2026-07-15",
    checkOut: "2026-07-17",
    nights: 2,
    directPrice: 9719,
    guestSavings: 510,
    ownerGain: 1050,
    guestFacingPrice: 10229,
  };

  test("omit preset behaves as standard", () => {
    const implicit = generateDirectOffer(base);
    const explicit = generateDirectOffer({ ...base, preset: "standard" });
    expect(implicit).toEqual(explicit);
  });

  test("standard contains unit, dates, direct price", () => {
    const t = generateDirectOffer({ ...base, preset: "standard" });
    expect(t.telegramText).toContain("Квартира тест");
    expect(t.telegramText).toContain("15.07.2026");
    expect(t.telegramText).toContain("17.07.2026");
    expect(t.telegramText.replace(/\s/g, "")).toMatch(/9719/);
  });

  test("telegram differs for standard vs official", () => {
    const std = generateDirectOffer({ ...base, preset: "standard" });
    const off = generateDirectOffer({ ...base, preset: "official" });
    expect(std.telegramText).not.toBe(off.telegramText);
    expect(std.telegramText).toContain("Здравствуйте!");
    expect(off.telegramText).toContain("Добрый день.");
    expect(off.telegramText).not.toContain("Здравствуйте!");
  });

  test("whatsapp differs for standard vs repeat_guest", () => {
    const std = generateDirectOffer({ ...base, preset: "standard" });
    const rep = generateDirectOffer({ ...base, preset: "repeat_guest" });
    expect(std.whatsappText).not.toBe(rep.whatsappText);
    expect(rep.whatsappText).toContain("Если вы уже останавливались у нас, будем рады видеть вас снова.");
  });

  test("last_minute mentions free window hook", () => {
    const t = generateDirectOffer({ ...base, preset: "last_minute" });
    expect(t.telegramText.toLowerCase()).toContain("свободное окно");
    expect(t.whatsappText.toLowerCase()).toContain("свободное окно");
  });

  test("repeat_guest telegram contains soft repeat phrase", () => {
    const t = generateDirectOffer({ ...base, preset: "repeat_guest" });
    expect(t.telegramText).toContain("Если вы уже останавливались у нас, будем рады видеть вас снова.");
  });

  test("shortText for every preset includes formatted direct price", () => {
    const priceToken = fmtRub(base.directPrice).replace(/\s/g, "");
    for (const preset of ["standard", "official", "repeat_guest", "last_minute"] as const) {
      const t = generateDirectOffer({ ...base, preset });
      expect(t.shortText.replace(/\s/g, "")).toContain(priceToken.replace(/\s/g, ""));
    }
  });

  test("ownerGain never appears in texts for any preset", () => {
    const og = 919_919;
    for (const preset of ["standard", "official", "repeat_guest", "last_minute"] as const) {
      const t = generateDirectOffer({ ...base, ownerGain: og, preset });
      expect(t.telegramText).not.toContain("919919");
      expect(t.whatsappText).not.toContain("919919");
      expect(t.shortText).not.toContain("919919");
    }
  });

  test("guestSavings omitted from outputs when <= 0 for all presets", () => {
    for (const preset of ["standard", "official", "repeat_guest", "last_minute"] as const) {
      const t = generateDirectOffer({ ...base, guestSavings: -1, preset });
      expect(t.shortText.toLowerCase()).not.toContain("экономия");
      const t0 = generateDirectOffer({ ...base, guestSavings: 0, preset });
      expect(t0.telegramText.toLowerCase()).not.toContain("экономия для вас примерно");
    }
  });

  test("custom bookingInstruction in all presets", () => {
    const custom = "Тестовая инструкция бронирования D1.9.";
    for (const preset of ["standard", "official", "repeat_guest", "last_minute"] as const) {
      const t = generateDirectOffer({ ...base, bookingInstruction: custom, preset });
      expect(t.telegramText).toContain(custom);
      expect(t.whatsappText).toContain(custom);
    }
  });

  test("contact lines work for all presets", () => {
    for (const preset of ["standard", "official", "repeat_guest", "last_minute"] as const) {
      const t = generateDirectOffer({
        ...base,
        contactName: "Иван",
        contactPhone: "+70000000000",
        preset,
      });
      expect(t.telegramText).toContain("Иван");
      expect(t.telegramText).toContain("+70000000000");
      expect(t.whatsappText).toContain("Иван");
    }
  });
});
