"use client";

import { useMemo, useState, useTransition } from "react";
import type { PricingRecommendation } from "@/lib/adminApi";
import { buildManualReferralLeadPrefillFromRecommendation } from "@/lib/manual-referral-lead";
import { computeReferralEconomicsFromRecommendation } from "@/lib/referral-economics-from-recommendation";
import { saveManualReferralLeadAction } from "./referralLeadActions";

type Props = { rec: PricingRecommendation };

/** D2.3 — manual referral lead log; audit only. */
export function ManualReferralLeadPanel({ rec }: Props) {
  const economics = useMemo(
    () => computeReferralEconomicsFromRecommendation(rec),
    [rec],
  );

  const prefill = useMemo(
    () => buildManualReferralLeadPrefillFromRecommendation(rec),
    [rec],
  );

  const [referrerName, setReferrerName] = useState("");
  const [referrerContact, setReferrerContact] = useState("");
  const [referredName, setReferredName] = useState("");
  const [referredContact, setReferredContact] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (
    !economics.hasRequiredInputs ||
    !economics.result.isReferralEconomicallyValid
  ) {
    return null;
  }

  const fieldCls =
    "w-full rounded border border-indigo-200 bg-white px-2 py-1 text-[11px] text-gray-800";

  const handleSave = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await saveManualReferralLeadAction(rec, {
        referrer_name: referrerName,
        referrer_contact: referrerContact,
        referred_guest_name: referredName,
        referred_guest_contact: referredContact,
        notes,
      });
      if (!res.ok) {
        setError(res.error ?? "Ошибка сохранения");
        return;
      }
      setMessage(res.message ?? "Referral lead saved to audit log.");
    });
  };

  return (
    <details className="rounded-lg border border-indigo-300/80 bg-white/60 px-3 py-2 mt-2 text-xs text-indigo-950">
      <summary className="cursor-pointer font-semibold text-indigo-900 select-none">
        Log manual referral
      </summary>
      <p className="mt-2 text-[10px] text-indigo-800/90">
        Ручная запись для контроля. Не создаёт бронь и не запускает выплату.
      </p>
      <p className="text-[10px] text-gray-600 mt-1">
        Контекст: №{prefill.apartment_id} · {prefill.date_from} → {prefill.date_to}
        {prefill.referral_price != null && (
          <>
            {" "}
            · ориентир reward {prefill.referral_reward} ₽
          </>
        )}
      </p>

      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-600">Кто рекомендует (имя)</span>
          <input
            type="text"
            value={referrerName}
            onChange={(e) => setReferrerName(e.target.value)}
            className={fieldCls}
            disabled={isPending}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-600">Контакт рекомендующего</span>
          <input
            type="text"
            value={referrerContact}
            onChange={(e) => setReferrerContact(e.target.value)}
            className={fieldCls}
            disabled={isPending}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-600">Кого рекомендует (имя)</span>
          <input
            type="text"
            value={referredName}
            onChange={(e) => setReferredName(e.target.value)}
            className={fieldCls}
            disabled={isPending}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-600">Контакт рекомендуемого</span>
          <input
            type="text"
            value={referredContact}
            onChange={(e) => setReferredContact(e.target.value)}
            className={fieldCls}
            disabled={isPending}
          />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-600">Заметки</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={fieldCls + " resize-y"}
            disabled={isPending}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-3 py-1 text-[11px] rounded border border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save referral lead"}
        </button>
      </div>

      {message && <p className="mt-2 text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </details>
  );
}
