"use client";

import { useEffect, useMemo, useState } from "react";
import type { PricingRecommendation } from "@/lib/adminApi";
import {
  DIRECT_OFFER_PRESETS,
  generateDirectOffer,
  nightsWord,
  resolveNights,
  type DirectOfferPreset,
} from "@/lib/direct-offer-generator";
import {
  getDirectOfferEnvDefaults,
  loadDirectOfferSettings,
  resetDirectOfferSettings,
  saveDirectOfferSettings,
  type DirectOfferSettings,
} from "@/lib/direct-offer-settings";
import { buildDirectOfferInputFromRecommendation } from "@/lib/direct-offer-from-recommendation";

async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof window !== "undefined" &&
      window.isSecureContext &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* execCommand fallback */
  }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type Props = { rec: PricingRecommendation };

function fmtRu(n: number | null | undefined, fallback = "—") {
  if (n == null || typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.round(n).toLocaleString("ru-RU");
}

function previewRows(text: string, maxRows = 12): number {
  const n = text.split("\n").length + 2;
  return Math.max(4, Math.min(maxRows, n));
}

/** D1.3 — строка рекомендации + шаблон (env/localStorage), без угадывания схемы в JSX. */
export function DirectOfferPanel({ rec }: Props) {

  const [tpl, setTpl] = useState<DirectOfferSettings>(() => getDirectOfferEnvDefaults());

  useEffect(() => {
    setTpl(loadDirectOfferSettings());
  }, []);

  const patchTpl = (partial: Partial<DirectOfferSettings>) => {
    setTpl((prev) => {
      const next: DirectOfferSettings = { ...prev, ...partial };
      saveDirectOfferSettings(next);
      return next;
    });
  };

  const handleResetDefaults = () => {
    const next = resetDirectOfferSettings();
    setTpl(next);
  };

  const [preset, setPreset] = useState<DirectOfferPreset>("standard");

  const mergedInput = useMemo(
    () => buildDirectOfferInputFromRecommendation(rec, tpl),
    [rec, tpl],
  );

  const texts = useMemo(
    () =>
      mergedInput
        ? generateDirectOffer({ ...mergedInput, preset })
        : null,
    [mergedInput, preset],
  );

  const [lastCopyLabel, setLastCopyLabel] = useState<string | null>(null);
  const [copyErr, setCopyErr] = useState(false);

  if (!mergedInput || !texts) return null;

  const guestSavings = mergedInput.guestSavings;
  const ownerGain = mergedInput.ownerGain;
  const nNights = resolveNights(mergedInput);
  const dateCtx =
    mergedInput.checkIn && mergedInput.checkOut
      ? `${mergedInput.checkIn} → ${mergedInput.checkOut}`
      : "даты уточняются";

  const handleCopy = async (label: string, body: string) => {
    setCopyErr(false);
    const ok = await copyText(body);
    if (ok) {
      setLastCopyLabel(label);
      window.setTimeout(() => setLastCopyLabel((x) => (x === label ? null : x)), 2500);
    } else {
      setCopyErr(true);
    }
  };

  const fieldCls =
    "w-full rounded border border-teal-200 bg-white px-2 py-1 text-[11px] text-gray-800 placeholder:text-gray-400";

  return (
    <div
      className="rounded-xl border px-4 py-3 mt-2 text-sm"
      style={{ background: "#F0FDFA", borderColor: "#99F6E4" }}
    >
      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-teal-900">
          Direct Offer
        </span>
        <span className="text-xs text-teal-800">
          D1.3 — контекст строки + шаблон (localStorage)
        </span>
      </div>

      <p className="text-[10px] text-gray-600 mb-2 leading-snug">
        <span className="font-semibold text-teal-900">Контекст оффера:</span>{" "}
        {mergedInput.unitName} · №{rec.apartment_id} · {dateCtx} · {nNights} {nightsWord(nNights)} ·{" "}
        {fmtRu(mergedInput.directPrice)} ₽/ночь
      </p>

      <div className="grid sm:grid-cols-3 gap-2 mb-3 text-xs text-teal-950">
        <div className="rounded-lg bg-white/80 border border-teal-100 px-3 py-2">
          <p className="font-semibold text-teal-900">Цена напрямую</p>
          <p className="text-lg font-bold text-gray-900">{fmtRu(mergedInput.directPrice)} ₽</p>
          <p className="text-[10px] text-gray-500 mt-0.5">ориентир / ночь</p>
        </div>
        <div className="rounded-lg bg-white/80 border border-teal-100 px-3 py-2">
          <p className="font-semibold text-teal-900">Гость экономит</p>
          <p className="text-lg font-bold text-gray-900">
            {guestSavings != null && Number.isFinite(guestSavings) ? `${fmtRu(guestSavings)} ₽` : "—"}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">vs агрегатор</p>
        </div>
        <div className="rounded-lg bg-white/80 border border-teal-100 px-3 py-2">
          <p className="font-semibold text-teal-900">Владельцу выгоднее</p>
          <p className="text-lg font-bold text-gray-900">
            {ownerGain != null && Number.isFinite(ownerGain) ? `+${fmtRu(ownerGain)} ₽` : "—"}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">vs RC net</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-teal-900 font-semibold shrink-0" htmlFor="direct-offer-preset">
          Стиль оффера
        </label>
        <select
          id="direct-offer-preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value as DirectOfferPreset)}
          className="rounded border border-teal-200 bg-white px-2 py-1 text-[11px] text-gray-900 max-w-[14rem]"
        >
          {DIRECT_OFFER_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 rounded-lg border border-teal-100 bg-white/60 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-900">
            Локальные поля шаблона
          </p>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2 py-0.5 text-[10px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Reset to defaults
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="sm:col-span-2 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-600">Инструкция по бронированию</span>
            <textarea
              value={tpl.bookingInstruction}
              onChange={(e) => patchTpl({ bookingInstruction: e.target.value })}
              placeholder="Оставьте пустым — подставится стандартная фраза"
              rows={2}
              className={fieldCls + " resize-y"}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-600">Контакт (имя)</span>
            <input
              type="text"
              value={tpl.contactName}
              onChange={(e) => patchTpl({ contactName: e.target.value })}
              className={fieldCls}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-600">Телефон / username</span>
            <input
              type="text"
              value={tpl.contactPhone}
              onChange={(e) => patchTpl({ contactPhone: e.target.value })}
              className={fieldCls}
            />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-600">Подпись объекта</span>
            <input
              type="text"
              value={tpl.propertyName}
              onChange={(e) => patchTpl({ propertyName: e.target.value })}
              placeholder="Например: Гостевой дом Акваторинг"
              className={fieldCls}
            />
          </label>
        </div>
      </div>

      {copyErr && (
        <p className="text-xs text-red-700 mb-2">
          Автокопирование недоступно — выделите текст в нужном поле и скопируйте вручную.
        </p>
      )}
      {lastCopyLabel && (
        <p className="text-xs text-emerald-700 mb-2">✓ скопировано: {lastCopyLabel}</p>
      )}

      <div className="space-y-3">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold text-sky-950">Telegram</span>
            <button
              type="button"
              onClick={() => handleCopy("Telegram", texts.telegramText)}
              className="px-2 py-1 text-[11px] rounded border border-teal-400 bg-white text-teal-900 hover:bg-teal-50 font-medium shadow-sm"
            >
              Copy Telegram
            </button>
          </div>
          <textarea
            readOnly
            value={texts.telegramText}
            rows={previewRows(texts.telegramText, 16)}
            className="w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-[11px] text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-teal-300"
            aria-label="Предпросмотр Telegram"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold text-emerald-950">WhatsApp</span>
            <button
              type="button"
              onClick={() => handleCopy("WhatsApp", texts.whatsappText)}
              className="px-2 py-1 text-[11px] rounded border border-teal-400 bg-white text-teal-900 hover:bg-teal-50 font-medium shadow-sm"
            >
              Copy WhatsApp
            </button>
          </div>
          <textarea
            readOnly
            value={texts.whatsappText}
            rows={previewRows(texts.whatsappText, 10)}
            className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[11px] text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-teal-300"
            aria-label="Предпросмотр WhatsApp"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold text-gray-800">Short</span>
            <button
              type="button"
              onClick={() => handleCopy("Short", texts.shortText)}
              className="px-2 py-1 text-[11px] rounded border border-teal-400 bg-white text-teal-900 hover:bg-teal-50 font-medium shadow-sm"
            >
              Copy Short
            </button>
          </div>
          <textarea
            readOnly
            value={texts.shortText}
            rows={previewRows(texts.shortText, 6)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-teal-300"
            aria-label="Предпросмотр Short"
          />
        </div>
      </div>
    </div>
  );
}
