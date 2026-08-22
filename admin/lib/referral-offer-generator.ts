/**
 * D2.2 — referral invitation copy for former guests (manual send only).
 * Not mixed with generateDirectOffer / D1.9 presets.
 */

export const DEFAULT_REFERRAL_REWARD_RATE = 0.05;

export const DEFAULT_REFERRAL_BOOKING_INSTRUCTION =
  "Напишите нам, кого вы хотите порекомендовать, и мы вручную зафиксируем рекомендацию.";

export type ReferralOfferInput = {
  propertyName?: string | null;
  unitName?: string | null;
  referralRewardRate?: number | null;
  exampleBookingAmount?: number | null;
  exampleReward?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  bookingInstruction?: string | null;
};

export type ReferralOfferTexts = {
  telegramText: string;
  whatsappText: string;
  shortText: string;
};

const RU_LOCALE = "ru-RU";

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t ? t : null;
}

function resolveRewardRate(rate: number | null | undefined): number {
  if (rate != null && Number.isFinite(rate) && rate > 0 && rate < 1) return rate;
  return DEFAULT_REFERRAL_REWARD_RATE;
}

export function formatReferralRewardPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function fmtRub(amount: number): string {
  return `${Math.round(amount).toLocaleString(RU_LOCALE)} ₽`;
}

function resolvePlaceLabel(input: ReferralOfferInput): string | null {
  return trimOrNull(input.propertyName) ?? trimOrNull(input.unitName);
}

function resolveExample(
  input: ReferralOfferInput,
  rate: number,
): { amount: number | null; reward: number | null } {
  const raw = input.exampleBookingAmount;
  if (raw == null || typeof raw !== "number" || !Number.isFinite(raw) || !(raw > 0)) {
    return { amount: null, reward: null };
  }
  const amount = Math.round(raw);
  const override = input.exampleReward;
  const reward =
    override != null && typeof override === "number" && Number.isFinite(override) && override > 0
      ? Math.round(override)
      : Math.round(amount * rate);
  return { amount, reward };
}

function buildContactLine(input: ReferralOfferInput): string | null {
  const name = trimOrNull(input.contactName);
  const phone = trimOrNull(input.contactPhone);
  if (name && phone) return `Контакт: ${name}, ${phone}`;
  if (name) return `Контакт: ${name}`;
  if (phone) return `Контакт: ${phone}`;
  return null;
}

function resolveBookingClosing(input: ReferralOfferInput): string {
  return trimOrNull(input.bookingInstruction) ?? DEFAULT_REFERRAL_BOOKING_INSTRUCTION;
}

function buildExampleLine(example: { amount: number; reward: number }): string {
  return `Например, при бронировании на ${fmtRub(example.amount)} благодарность составит ${fmtRub(example.reward)}.`;
}

function appendFooter(parts: string[], input: ReferralOfferInput): void {
  const contact = buildContactLine(input);
  if (contact) parts.push(contact);
  parts.push(resolveBookingClosing(input));
}

export function generateReferralOffer(input: ReferralOfferInput): ReferralOfferTexts {
  const rate = resolveRewardRate(input.referralRewardRate);
  const pct = formatReferralRewardPercent(rate);
  const place = resolvePlaceLabel(input);
  const example = resolveExample(input, rate);
  const placePhrase = place ? ` «${place}»` : "";

  const intro =
    `Если вы уже останавливались у нас${placePhrase} и порекомендуете нас знакомым, мы будем рады поблагодарить вас: ${pct} от суммы бронирования по вашей рекомендации.`;

  const telegramParts = [
    intro,
    "",
    "Новый гость может забронировать напрямую, без комиссии агрегатора. Условия и факт брони подтверждаются вручную — это не автоматическая выплата и не публичная акция.",
  ];
  if (example.amount != null && example.reward != null) {
    telegramParts.push("", buildExampleLine({ amount: example.amount, reward: example.reward }));
  }
  telegramParts.push("");
  appendFooter(telegramParts, input);
  const telegramText = telegramParts.join("\n").trim();

  const whatsappParts = [
    intro,
    "Прямое бронирование для знакомых — без агрегатора. Благодарность после подтверждённой брони, вручную.",
  ];
  if (example.amount != null && example.reward != null) {
    whatsappParts.push(buildExampleLine({ amount: example.amount, reward: example.reward }));
  }
  appendFooter(whatsappParts, input);
  const whatsappText = whatsappParts.join("\n").trim();

  const shortPlace = place ?? "нас";
  const shortText = [
    `Рекомендуйте ${shortPlace} знакомым — ${pct} от суммы брони по вашей рекомендации после подтверждения.`,
    resolveBookingClosing(input),
  ].join(" ");

  return { telegramText, whatsappText, shortText };
}
