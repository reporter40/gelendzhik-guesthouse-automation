import { describe, expect, test } from "vitest";
import {
  DIRECT_OFFER_LS_KEY,
  loadDirectOfferSettings,
  saveDirectOfferSettings,
  resetDirectOfferSettings,
  getDirectOfferEnvDefaults,
  type DirectOfferSettings,
  type DirectOfferSettingsStorage,
} from "./direct-offer-settings";

function memStore(): DirectOfferSettingsStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

const testEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_DEFAULT_BOOKING_INSTRUCTION: "ENV booking",
  NEXT_PUBLIC_DIRECT_OFFER_CONTACT_NAME: "ENV Name",
  NEXT_PUBLIC_DIRECT_OFFER_CONTACT_PHONE: "+7000",
  NEXT_PUBLIC_DIRECT_OFFER_PROPERTY_NAME: "ENV Prop",
};

describe("getDirectOfferEnvDefaults", () => {
  test("reads NEXT_PUBLIC keys from passed env", () => {
    const d = getDirectOfferEnvDefaults(testEnv);
    expect(d.bookingInstruction).toBe("ENV booking");
    expect(d.contactName).toBe("ENV Name");
    expect(d.contactPhone).toBe("+7000");
    expect(d.propertyName).toBe("ENV Prop");
  });

  test("missing keys become empty string", () => {
    const d = getDirectOfferEnvDefaults({});
    expect(d.bookingInstruction).toBe("");
    expect(d.contactName).toBe("");
  });
});

describe("loadDirectOfferSettings / save / reset", () => {
  test("localStorage values override env when string fields present", () => {
    const storage = memStore();
    const loaded = loadDirectOfferSettings({ storage, env: testEnv });
    expect(loaded.contactName).toBe("ENV Name");

    saveDirectOfferSettings(
      {
        bookingInstruction: "",
        contactName: "LS Марина",
        contactPhone: "+7999",
        propertyName: "LS Prop",
      },
      { storage, env: testEnv },
    );

    const after = loadDirectOfferSettings({ storage, env: testEnv });
    expect(after.contactName).toBe("LS Марина");
    expect(after.contactPhone).toBe("+7999");
    expect(after.propertyName).toBe("LS Prop");
    expect(after.bookingInstruction).toBe("");
  });

  test("corrupted JSON falls back to env defaults", () => {
    const storage = memStore();
    storage.setItem(DIRECT_OFFER_LS_KEY, "not-json {{{");
    const d = loadDirectOfferSettings({ storage, env: testEnv });
    expect(d).toEqual(getDirectOfferEnvDefaults(testEnv));
  });

  test("reset clears key and returns env defaults", () => {
    const storage = memStore();
    saveDirectOfferSettings(
      {
        bookingInstruction: "x",
        contactName: "y",
        contactPhone: "z",
        propertyName: "w",
      },
      { storage, env: testEnv },
    );
    expect(storage.getItem(DIRECT_OFFER_LS_KEY)).toBeTruthy();
    const r = resetDirectOfferSettings({ storage, env: testEnv });
    expect(r).toEqual(getDirectOfferEnvDefaults(testEnv));
    expect(storage.getItem(DIRECT_OFFER_LS_KEY)).toBeNull();
  });

  test("load without options works when window/storage unavailable (SSR/Node)", () => {
    expect(() => loadDirectOfferSettings()).not.toThrow();
  });

  test("save without storage is no-op and does not throw", () => {
    const d = loadDirectOfferSettings({ storage: null, env: testEnv });
    expect(d.contactName).toBe("ENV Name");
    expect(() =>
      saveDirectOfferSettings(
        {
          bookingInstruction: "a",
          contactName: "b",
          contactPhone: "c",
          propertyName: "d",
        },
        { storage: null, env: testEnv },
      ),
    ).not.toThrow();
  });

  test("null / non-string in stored JSON fall back to env for that field", () => {
    const storage = memStore();
    storage.setItem(
      DIRECT_OFFER_LS_KEY,
      JSON.stringify({
        bookingInstruction: "custom inst",
        contactName: null,
        contactPhone: 123,
        propertyName: undefined,
      }),
    );
    const d = loadDirectOfferSettings({ storage, env: testEnv });
    expect(d.bookingInstruction).toBe("custom inst");
    expect(d.contactName).toBe("ENV Name");
    expect(d.contactPhone).toBe("+7000");
    expect(d.propertyName).toBe("ENV Prop");
  });

  test("bookingInstruction may be empty string from storage", () => {
    const storage = memStore();
    storage.setItem(
      DIRECT_OFFER_LS_KEY,
      JSON.stringify({
        bookingInstruction: "",
        contactName: "only",
        contactPhone: "",
        propertyName: "",
      }),
    );
    const d = loadDirectOfferSettings({ storage, env: testEnv });
    expect(d.bookingInstruction).toBe("");
    expect(d.contactName).toBe("only");
  });

  test("save/load roundtrip preserves multiline booking instruction", () => {
    const storage = memStore();
    const original: DirectOfferSettings = {
      bookingInstruction: "Line1\nLine2\n  spaces  ",
      contactName: "",
      contactPhone: "",
      propertyName: "",
    };
    saveDirectOfferSettings(original, { storage, env: testEnv });
    const json = storage.getItem(DIRECT_OFFER_LS_KEY);
    expect(json).not.toContain("null");
    const back = loadDirectOfferSettings({ storage, env: testEnv });
    expect(back.bookingInstruction).toBe(original.bookingInstruction);
  });
});
