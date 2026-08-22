/**
 * D1.0 / D1.1 — текст прямого предложения гостю (без отправки в мессенджеры).
 * D1.9 — стили (preset): standard / official / repeat_guest / last_minute.
 */

export type DirectOfferPreset = "standard" | "official" | "repeat_guest" | "last_minute";

export const DIRECT_OFFER_PRESETS = [
  { value: "standard", label: "Стандартный" },
  { value: "official", label: "Официальный" },
  { value: "repeat_guest", label: "Повторный гость" },
  { value: "last_minute", label: "Горящее окно" },
] as const;

export type DirectOfferInput = {
  unitName: string;
  checkIn: string;
  checkOut: string;
  /** Если не передано — считается из checkIn/checkOut (ночи между датами). */
  nights?: number | null;
  directPrice: number;
  guestSavings?: number | null;
  ownerGain?: number | null;
  /** Ориентир «как через агрегаторе» для гостя; если нет — в текстах не упоминается */
  marketPrice?: number | null;
  guestFacingPrice?: number | null;
  /**
   * Кастомная финальная инструкция по бронированию.
   * Если пусто / не передано — подставляется DEFAULT_BOOKING_INSTRUCTION.
   */
  bookingInstruction?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  /** Доп. подпись к объекту (район, тип жилья и т.п.) */
  propertyName?: string | null;
  /** D1.9 — стиль текстов; по умолчанию standard. */
  preset?: DirectOfferPreset;
};

export type DirectOfferTexts = {
  telegramText: string;
  whatsappText: string;
  shortText: string;
};

export const DEFAULT_BOOKING_INSTRUCTION =
  "Если даты подходят — напишите, пожалуйста, подтверждение, и мы зафиксируем предложение.";

const RU_LOCALE = "ru-RU";

export function fmtRub(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString(RU_LOCALE)} ₽`;
}

/** Календарная дата YYYY-MM-DD → ДД.MM.ГГГГ (без сдвига часовых поясов). */
export function formatOfferDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/**
 * Количество ночей между заездом (checkIn) и выездом (checkOut),
 * считая ночей столько же, как в pricing_recommendations (date_to − date_from по дням).
 */
export function computeNightsBetween(checkIn: string, checkOut: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(checkIn.trim());
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(checkOut.trim());
  if (!a || !b) return 1;
  const t0 = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const t1 = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  const diff = Math.round((t1 - t0) / 86400000);
  return diff >= 1 ? diff : 1;
}

/** Словоформа «ночь» для русского. */
export function nightsWord(n: number): string {
  const k = Math.abs(Math.trunc(n)) % 100;
  const v = k % 10;
  if (k >= 11 && k <= 14) return "ночей";
  if (v === 1) return "ночь";
  if (v >= 2 && v <= 4) return "ночи";
  return "ночей";
}

export function resolveNights(input: DirectOfferInput): number {
  if (input.nights != null && Number.isFinite(input.nights) && input.nights >= 1) {
    return Math.round(input.nights);
  }
  return computeNightsBetween(input.checkIn, input.checkOut);
}

function aggregatorGuestHint(input: DirectOfferInput): number | null {
  const v = input.guestFacingPrice ?? input.marketPrice ?? null;
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v);
}

function resolveGuestSavings(input: DirectOfferInput): number | null {
  if (input.guestSavings == null || !Number.isFinite(input.guestSavings)) return null;
  const s = Math.round(input.guestSavings);
  return s > 0 ? s : null;
}

function resolvePreset(input: DirectOfferInput): DirectOfferPreset {
  return input.preset ?? "standard";
}

export function resolveBookingClosing(input: DirectOfferInput): string {
  const c = input.bookingInstruction?.trim();
  return c && c.length > 0 ? c : DEFAULT_BOOKING_INSTRUCTION;
}

/** Строка контакта; null если оба поля пустые. */
export function formatContactLine(input: DirectOfferInput): string | null {
  const name = input.contactName?.trim();
  const phone = input.contactPhone?.trim();
  if (!name && !phone) return null;
  if (name && phone) return `${name}, ${phone}`;
  return name ?? phone ?? null;
}

function formatStayPresentation(
  input: DirectOfferInput,
  nightsPhrase: string,
): {
  telegramPeriodLines: string[];
  waPeriodLine: string;
  shortPeriodSegment: string;
} {
  const cin = (input.checkIn ?? "").trim();
  const cout = (input.checkOut ?? "").trim();
  const validIn = /^\d{4}-\d{2}-\d{2}$/.test(cin);
  const validOut = /^\d{4}-\d{2}-\d{2}$/.test(cout);
  if (validIn && validOut) {
    const di = formatOfferDate(cin);
    const doo = formatOfferDate(cout);
    return {
      telegramPeriodLines: ["Период:", `${di} — ${doo} (${nightsPhrase}).`, ""],
      waPeriodLine: `${di}–${doo}, ${nightsPhrase}.`,
      shortPeriodSegment: `${di}—${doo}, ${nightsPhrase}`,
    };
  }
  return {
    telegramPeriodLines: ["Период:", `Даты уточним — ориентир ${nightsPhrase}.`, ""],
    waPeriodLine: `Даты уточним, ${nightsPhrase}.`,
    shortPeriodSegment: `${nightsPhrase} (даты уточним)`,
  };
}

function savingsTelegramBlock(
  preset: DirectOfferPreset,
  savingsStr: string | null,
  aggHint: number | null,
): string | null {
  if (savingsStr != null) {
    if (preset === "official") {
      return `Экономия по сравнению с типичной ценой на агрегаторах: примерно ${savingsStr} за ночь.`;
    }
    return `Это выгоднее, чем через агрегатор: экономия для вас примерно ${savingsStr} (ориентир на ночь).`;
  }
  if (aggHint != null) {
    if (preset === "official") {
      return `На агрегаторах аналогичные варианты часто оцениваются около ${aggHint.toLocaleString(RU_LOCALE)} ₽ за ночь; при прямом бронировании посредническая комиссия не применяется.`;
    }
    return `На агрегаторах похожие варианты часто выходят около ${aggHint.toLocaleString(RU_LOCALE)} ₽ за ночь — при прямом бронировании цена прозрачнее, без комиссии посредника.`;
  }
  return null;
}

function savingsWhatsappBlock(
  preset: DirectOfferPreset,
  savingsStr: string | null,
  aggHint: number | null,
): string | null {
  if (savingsStr != null) {
    if (preset === "official") {
      return `Экономия к типичной цене на агрегаторах: ориентир ~${savingsStr} / ночь.`;
    }
    return `Выгоднее агрегатора примерно на ${savingsStr} / ночь.`;
  }
  if (aggHint != null) {
    if (preset === "official") {
      return `На площадках ценовой ориентир часто ~${aggHint.toLocaleString(RU_LOCALE)} ₽/ночь; прямой контакт без посреднической наценки.`;
    }
    return `На площадках цена часто ~${aggHint.toLocaleString(RU_LOCALE)} ₽/ночь — у нас прямой контракт, без лишней наценки.`;
  }
  return null;
}

const REPEAT_SOFT_LINE =
  "Если вы уже останавливались у нас, будем рады видеть вас снова.";

const LAST_MINUTE_HOOK = "Появилось свободное окно на эти даты.";

export function generateDirectOffer(input: DirectOfferInput): DirectOfferTexts {
  const preset = resolvePreset(input);
  const nights = resolveNights(input);
  const nightsPhrase = `${nights} ${nightsWord(nights)}`;
  const { telegramPeriodLines, waPeriodLine, shortPeriodSegment } = formatStayPresentation(
    input,
    nightsPhrase,
  );
  const directStr = fmtRub(input.directPrice);
  const savings = resolveGuestSavings(input);
  const savingsStr = savings != null ? `${savings.toLocaleString(RU_LOCALE)} ₽` : null;
  const aggHint = aggregatorGuestHint(input);
  const bookingClosing = resolveBookingClosing(input);
  const contactLine = formatContactLine(input);

  const prop = input.propertyName?.trim();
  const unit = input.unitName.trim();

  const savingsTelegram = savingsTelegramBlock(preset, savingsStr, aggHint);
  const savingsWhatsapp = savingsWhatsappBlock(preset, savingsStr, aggHint);

  const tgGreeting = preset === "official" ? "Добрый день." : "Здравствуйте!";
  const tgLines: string[] = [tgGreeting, ""];

  if (preset === "last_minute") {
    tgLines.push(LAST_MINUTE_HOOK, "");
  }

  if (prop) {
    tgLines.push(prop, "");
  }

  if (preset === "repeat_guest") {
    tgLines.push(`Есть вариант проживания: ${unit}.`, "", REPEAT_SOFT_LINE, "");
  } else {
    tgLines.push(`Есть вариант проживания: ${unit}.`, "");
  }

  tgLines.push(...telegramPeriodLines, `Цена напрямую от владельца: ${directStr} за ночь.`, "");

  if (savingsTelegram) {
    tgLines.push(savingsTelegram, "");
  }
  tgLines.push(
    preset === "official"
      ? "Бронирование осуществляется напрямую, без комиссии агрегатора."
      : "Бронирование напрямую, без комиссии агрегатора.",
    "",
    bookingClosing,
  );
  if (contactLine) {
    tgLines.push("", `Контакт: ${contactLine}.`);
  }
  const telegramText = tgLines.join("\n");

  let waHead: string;
  if (preset === "official") {
    waHead = prop ? `Добрый день. ${prop} — ${unit}.` : `Добрый день. Объект: ${unit}.`;
  } else if (preset === "repeat_guest") {
    waHead = prop
      ? `Здравствуйте! ${prop} — ${unit}.`
      : `Здравствуйте! Вариант проживания: ${unit}.`;
  } else {
    waHead = prop ? `Привет! ${prop} — ${unit}.` : `Привет! Вариант: ${unit}.`;
  }

  const waLines: string[] = [];
  if (preset === "last_minute") {
    waLines.push(LAST_MINUTE_HOOK);
  }
  waLines.push(waHead, `${waPeriodLine} Напрямую ${directStr}/ночь.`);
  if (preset === "repeat_guest") {
    waLines.push(REPEAT_SOFT_LINE);
  }
  if (savingsWhatsapp) waLines.push(savingsWhatsapp);
  waLines.push(
    preset === "official"
      ? "Без посреднической комиссии."
      : "Без комиссии посредника.",
    bookingClosing,
  );
  if (contactLine) waLines.push(`Написать: ${contactLine}`);
  const whatsappText = waLines.join("\n");

  let shortHead = prop ? `${prop}. ${unit}` : unit;
  const shortBits: string[] = [];
  if (preset === "last_minute") {
    shortBits.push("Свободное окно на эти даты.");
  }
  let shortCore = `${shortHead}, ${shortPeriodSegment}. Напрямую: ${directStr}.`;
  if (preset === "repeat_guest") {
    shortCore += ` ${REPEAT_SOFT_LINE}`;
  }
  if (savings != null && savingsStr != null) {
    shortCore += ` Экономия ≈ ${savingsStr}.`;
  }
  if (contactLine) {
    shortCore += ` ${contactLine}`;
  }
  const shortText = [...shortBits, shortCore].filter(Boolean).join(" ");

  return { telegramText, whatsappText, shortText };
}
