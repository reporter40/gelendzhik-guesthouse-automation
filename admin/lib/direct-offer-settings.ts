/**
 * D1.2 — env defaults + localStorage persistence for Direct Offer template fields.
 */

export const DIRECT_OFFER_LS_KEY = "directOfferSettings.v1";

export type DirectOfferSettings = {
  bookingInstruction: string;
  contactName: string;
  contactPhone: string;
  propertyName: string;
};

const ENV_KEYS = {
  bookingInstruction: "NEXT_PUBLIC_DEFAULT_BOOKING_INSTRUCTION",
  contactName: "NEXT_PUBLIC_DIRECT_OFFER_CONTACT_NAME",
  contactPhone: "NEXT_PUBLIC_DIRECT_OFFER_CONTACT_PHONE",
  propertyName: "NEXT_PUBLIC_DIRECT_OFFER_PROPERTY_NAME",
} as const;

function readEnv(
  key: keyof typeof ENV_KEYS,
  source: Record<string, string | undefined>,
): string {
  const v = source[ENV_KEYS[key]];
  return typeof v === "string" ? v : "";
}

/** Чтение defaults из NEXT_PUBLIC_* (для тестов можно передать свой объект env). */
export function getDirectOfferEnvDefaults(
  envSource?: Record<string, string | undefined>,
): DirectOfferSettings {
  const src =
    envSource ??
    (typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {});
  return {
    bookingInstruction: readEnv("bookingInstruction", src),
    contactName: readEnv("contactName", src),
    contactPhone: readEnv("contactPhone", src),
    propertyName: readEnv("propertyName", src),
  };
}

function getBrowserLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Строка из storage: только string; null/undefined/не-string → fallback env. */
function stringFieldFromStorage(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string") return raw;
  return undefined;
}

function mergeStoredWithEnv(
  stored: unknown,
  envDefaults: DirectOfferSettings,
): DirectOfferSettings {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return { ...envDefaults };
  }
  const o = stored as Record<string, unknown>;
  return {
    bookingInstruction:
      stringFieldFromStorage(o.bookingInstruction) ?? envDefaults.bookingInstruction,
    contactName: stringFieldFromStorage(o.contactName) ?? envDefaults.contactName,
    contactPhone: stringFieldFromStorage(o.contactPhone) ?? envDefaults.contactPhone,
    propertyName: stringFieldFromStorage(o.propertyName) ?? envDefaults.propertyName,
  };
}

export type DirectOfferSettingsStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type LoadSaveOptions = {
  storage?: DirectOfferSettingsStorage | null;
  env?: Record<string, string | undefined>;
};

function resolveStorage(explicit?: DirectOfferSettingsStorage | null): Storage | null {
  if (explicit === null) return null;
  if (explicit !== undefined) return explicit as Storage;
  return getBrowserLocalStorage();
}

/** Загрузка: localStorage поверх env; без window — только env. Битый JSON не роняет приложение. */
export function loadDirectOfferSettings(options?: LoadSaveOptions): DirectOfferSettings {
  const envDefaults = getDirectOfferEnvDefaults(options?.env);
  const storage = resolveStorage(options?.storage);
  if (!storage) return envDefaults;

  try {
    const raw = storage.getItem(DIRECT_OFFER_LS_KEY);
    if (raw == null || raw === "") return envDefaults;
    const parsed: unknown = JSON.parse(raw);
    return mergeStoredWithEnv(parsed, envDefaults);
  } catch {
    return envDefaults;
  }
}

function normalizeForSave(s: DirectOfferSettings): DirectOfferSettings {
  return {
    bookingInstruction:
      typeof s.bookingInstruction === "string" ? s.bookingInstruction : "",
    contactName: typeof s.contactName === "string" ? s.contactName : "",
    contactPhone: typeof s.contactPhone === "string" ? s.contactPhone : "",
    propertyName: typeof s.propertyName === "string" ? s.propertyName : "",
  };
}

/** Сохранение; при недоступном storage — no-op. */
export function saveDirectOfferSettings(
  settings: DirectOfferSettings,
  options?: LoadSaveOptions,
): void {
  const storage = resolveStorage(options?.storage);
  if (!storage) return;

  const normalized = normalizeForSave(settings);
  try {
    storage.setItem(DIRECT_OFFER_LS_KEY, JSON.stringify(normalized));
  } catch {
    /* quota / private mode */
  }
}

/** Удалить ключ из localStorage и вернуть env defaults. */
export function resetDirectOfferSettings(options?: LoadSaveOptions): DirectOfferSettings {
  const storage = resolveStorage(options?.storage);
  if (storage) {
    try {
      storage.removeItem(DIRECT_OFFER_LS_KEY);
    } catch {
      /* ignore */
    }
  }
  return getDirectOfferEnvDefaults(options?.env);
}
