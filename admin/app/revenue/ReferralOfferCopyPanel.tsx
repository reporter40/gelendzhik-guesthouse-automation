"use client";

import { useEffect, useMemo, useState } from "react";
import type { PricingRecommendation } from "@/lib/adminApi";
import { buildReferralOfferInputFromRecommendation } from "@/lib/referral-offer-from-recommendation";
import { generateReferralOffer } from "@/lib/referral-offer-generator";
import {
  getDirectOfferEnvDefaults,
  loadDirectOfferSettings,
  type DirectOfferSettings,
} from "@/lib/direct-offer-settings";

type Props = { rec: PricingRecommendation };

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

function previewRows(text: string, maxRows = 10): number {
  const n = text.split("\n").length + 2;
  return Math.max(3, Math.min(maxRows, n));
}

/** D2.2 — copy draft for former guest; manual send only. */
export function ReferralOfferCopyPanel({ rec }: Props) {
  const [tpl, setTpl] = useState<DirectOfferSettings>(() => getDirectOfferEnvDefaults());

  useEffect(() => {
    setTpl(loadDirectOfferSettings());
  }, []);

  const offerInput = useMemo(
    () => buildReferralOfferInputFromRecommendation(rec, tpl),
    [rec, tpl],
  );

  const texts = useMemo(
    () => (offerInput ? generateReferralOffer(offerInput) : null),
    [offerInput],
  );

  const [lastCopyLabel, setLastCopyLabel] = useState<string | null>(null);
  const [copyErr, setCopyErr] = useState(false);

  if (!offerInput || !texts) return null;

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

  return (
    <div
      className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2.5 mt-2 text-xs text-indigo-950"
    >
      <div className="flex flex-wrap items-baseline gap-2 mb-1">
        <span className="font-semibold text-indigo-900">
          Referral invitation · for former guest
        </span>
      </div>
      <p className="text-[10px] text-indigo-800/90 mb-2">
        Ручной текст. Не создаёт ссылку и не фиксирует выплату.
      </p>

      {copyErr && (
        <p className="text-red-700 mb-2">
          Автокопирование недоступно — скопируйте текст вручную.
        </p>
      )}
      {lastCopyLabel && (
        <p className="text-emerald-700 mb-2">✓ скопировано: {lastCopyLabel}</p>
      )}

      <div className="space-y-2.5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold text-indigo-950">Telegram</span>
            <button
              type="button"
              onClick={() => handleCopy("Telegram", texts.telegramText)}
              className="px-2 py-0.5 text-[10px] rounded border border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"
            >
              Copy Telegram
            </button>
          </div>
          <textarea
            readOnly
            value={texts.telegramText}
            rows={previewRows(texts.telegramText, 14)}
            className="w-full rounded border border-indigo-100 bg-white px-2 py-1 text-[11px] text-gray-800 leading-relaxed resize-y"
            aria-label="Referral Telegram draft"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold text-indigo-950">WhatsApp</span>
            <button
              type="button"
              onClick={() => handleCopy("WhatsApp", texts.whatsappText)}
              className="px-2 py-0.5 text-[10px] rounded border border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"
            >
              Copy WhatsApp
            </button>
          </div>
          <textarea
            readOnly
            value={texts.whatsappText}
            rows={previewRows(texts.whatsappText, 8)}
            className="w-full rounded border border-indigo-100 bg-white px-2 py-1 text-[11px] text-gray-800 leading-relaxed resize-y"
            aria-label="Referral WhatsApp draft"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-semibold text-indigo-950">Short</span>
            <button
              type="button"
              onClick={() => handleCopy("Short", texts.shortText)}
              className="px-2 py-0.5 text-[10px] rounded border border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"
            >
              Copy Short
            </button>
          </div>
          <textarea
            readOnly
            value={texts.shortText}
            rows={previewRows(texts.shortText, 4)}
            className="w-full rounded border border-indigo-100 bg-white px-2 py-1 text-[11px] text-gray-800 leading-relaxed resize-y"
            aria-label="Referral Short draft"
          />
        </div>
      </div>
    </div>
  );
}
