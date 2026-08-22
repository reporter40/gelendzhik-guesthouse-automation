import { describe, expect, test } from "vitest";
import type { PricingRecommendation } from "@/lib/adminApi";
import { generateDirectOffer } from "@/lib/direct-offer-generator";
import type { DirectOfferSettings } from "@/lib/direct-offer-settings";
import {
  buildDirectOfferInputFromRecommendation,
  buildDirectOfferRowBase,
  normalizeStayFieldsFromRow,
  rowUnitDisplayName,
  rowPropertyContextFallback,
} from "@/lib/direct-offer-from-recommendation";

function baseRow(over: Partial<PricingRecommendation> = {}): PricingRecommendation {
  return {
    apartment_id: "50",
    apartment_name: "Студия с видом на море",
    date_from: "2026-07-15",
    date_to: "2026-07-17",
    nights: 2,
    current_price: 7000,
    market_median: 11000,
    recommended_price: 10230,
    recommended_guest_price: 10230,
    expected_aggregator_guest_price: 10229,
    direct_price: 9719,
    direct_savings_for_guest: 510,
    direct_owner_gain: 1050,
    recommendation_type: "gap_fill_moderate",
    reason: "test",
    confidence: 0.8,
    status: "draft",
    ...over,
  };
}

const blankTemplate: DirectOfferSettings = {
  bookingInstruction: "",
  contactName: "",
  contactPhone: "",
  propertyName: "",
};

describe("rowUnitDisplayName / rowPropertyContextFallback", () => {
  test("unitName comes from apartment_name when present", () => {
    expect(rowUnitDisplayName(baseRow())).toContain("Студия");
    expect(rowUnitDisplayName(baseRow())).not.toContain("Объект №");
  });

  test("unitName falls back to Объект № when name empty", () => {
    expect(rowUnitDisplayName(baseRow({ apartment_name: "" }))).toBe("Объект №50");
  });

  test("property_context fallback trimmed", () => {
    expect(rowPropertyContextFallback(baseRow())).toBe("");
    expect(rowPropertyContextFallback(baseRow({ property_context: " Акваторинг " }))).toBe(
      "Акваторинг",
    );
  });
});

describe("normalizeStayFieldsFromRow / nights", () => {
  test("uses row nights when valid", () => {
    const n = normalizeStayFieldsFromRow(baseRow({ nights: 5 }));
    expect(n.nights).toBe(5);
    expect(n.checkIn).toBe("2026-07-15");
    expect(n.checkOut).toBe("2026-07-17");
  });

  test("computes nights from dates when nights not usable", () => {
    const n = normalizeStayFieldsFromRow(baseRow({ nights: 0 }));
    expect(n.nights).toBe(2);
  });

  test("invalid ISO dates yield empty strings; nights from row if valid", () => {
    const n = normalizeStayFieldsFromRow(
      baseRow({
        date_from: "bad",
        date_to: "also-bad",
        nights: 3,
      }),
    );
    expect(n.checkIn).toBe("");
    expect(n.checkOut).toBe("");
    expect(n.nights).toBe(3);
  });
});

describe("buildDirectOfferRowBase / merge template", () => {
  test("maps direct_price, savings, ownerGain without recomputing", () => {
    const row = baseRow({
      direct_price: 6000,
      direct_savings_for_guest: 120,
      direct_owner_gain: 340,
    });
    const b = buildDirectOfferRowBase(row)!;
    expect(b.directPrice).toBe(6000);
    expect(b.guestSavings).toBe(120);
    expect(b.ownerGain).toBe(340);
    expect(b.guestFacingPrice).toBe(10229);
  });

  test("null direct_price yields null base", () => {
    expect(buildDirectOfferRowBase(baseRow({ direct_price: null }))).toBeNull();
  });

  test("propertyName: template wins over row property_context", () => {
    const input = buildDirectOfferInputFromRecommendation(
      baseRow({ property_context: "Акваторинг" }),
      { ...blankTemplate, propertyName: "Ручная подпись" },
    );
    expect(input!.propertyName).toBe("Ручная подпись");
    expect(input!.unitName).toBe("Студия с видом на море");
  });

  test("propertyName uses row when template propertyName empty", () => {
    const input = buildDirectOfferInputFromRecommendation(
      baseRow({ property_context: "Акваторинг" }),
      blankTemplate,
    );
    expect(input!.propertyName).toBe("Акваторинг");
  });

  test("property_context does not alter row base pricing fields vs absent", () => {
    const rowPlain = baseRow({
      apartment_id: "41",
      direct_price: 8000,
      rc_net_price: 7500,
      recommended_guest_price: 9000,
    });
    const rowCtx = { ...rowPlain, property_context: "Акваторинг" };
    const a = buildDirectOfferRowBase(rowPlain)!;
    const b = buildDirectOfferRowBase(rowCtx)!;
    expect(a.directPrice).toBe(b.directPrice);
    expect(a.guestSavings).toBe(b.guestSavings);
    expect(a.ownerGain).toBe(b.ownerGain);
    expect(a.guestFacingPrice).toBe(b.guestFacingPrice);
    expect(a.marketPrice).toBe(b.marketPrice);
  });

  test("unitName stays apartment_name; property_context is not mixed into unitName", () => {
    expect(
      rowUnitDisplayName(
        baseRow({
          apartment_name: "Номер 41",
          property_context: "Акваторинг",
        }),
      ),
    ).toBe("Номер 41");
  });

  test("ownerGain is not exposed in guest telegram text", () => {
    const input = buildDirectOfferInputFromRecommendation(
      baseRow({ direct_owner_gain: 775501 }),
      blankTemplate,
    )!;
    expect(input.ownerGain).toBe(775501);
    const texts = generateDirectOffer(input);
    expect(texts.telegramText).not.toContain("775501");
  });
});

describe("generator + row: missing dates", () => {
  test("no Invalid Date phrasing; uses clarify copy", () => {
    const input = buildDirectOfferInputFromRecommendation(
      baseRow({
        date_from: "xxxx",
        date_to: "yyyy",
        nights: 2,
      }),
      blankTemplate,
    )!;
    expect(input.checkIn).toBe("");
    const t = generateDirectOffer(input);
    expect(t.telegramText.toLowerCase()).toContain("уточним");
    expect(t.telegramText).not.toMatch(/Invalid/i);
  });
});
