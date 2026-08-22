"use client";

import { useMemo } from "react";
import type { PricingRecommendation } from "@/lib/adminApi";
import { computeReferralEconomicsFromRecommendation } from "@/lib/referral-economics-from-recommendation";

type Props = { rec: PricingRecommendation };

function formatRub(value: number | null | undefined): string {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-violet-100 bg-white/70 px-2.5 py-1.5">
      <p className="text-[10px] text-violet-800">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

/** D2.1 — internal finance preview; not guest-facing, no links or payouts. */
export function ReferralEconomicsPreview({ rec }: Props) {
  const state = useMemo(
    () => computeReferralEconomicsFromRecommendation(rec),
    [rec],
  );

  if (!state.hasRequiredInputs) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 mt-2 text-xs text-amber-950"
        role="status"
      >
        <p className="font-semibold text-amber-900">Referral economics · internal</p>
        <p className="mt-1">{state.insufficientDataWarning}</p>
      </div>
    );
  }

  const { result } = state;

  if (!result.isReferralEconomicallyValid) {
    return (
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 mt-2 text-xs text-amber-950"
        role="status"
      >
        <p className="font-semibold text-amber-900">Referral economics · internal</p>
        <p className="mt-1 text-amber-800">Расчёт не рекомендуется для referral offer.</p>
        {result.warnings.length > 0 && (
          <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-amber-900">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[10px] text-amber-800/90">
          Внутренний расчёт. Не отправляется гостю.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2.5 mt-2 text-xs text-violet-950"
      role="status"
    >
      <p className="font-semibold text-violet-900">Referral economics · internal</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
        <Metric label="Referral price" value={formatRub(result.referralPrice)} />
        <Metric label="Reward to former guest" value={formatRub(result.referralReward)} />
        <Metric label="Owner net after reward" value={formatRub(result.referralOwnerNet)} />
        <Metric label="Guest saves vs market" value={formatRub(result.referralGuestSavings)} />
        <Metric
          label="Owner gain vs aggregator"
          value={formatRub(result.referralOwnerGainVsAggregator)}
        />
      </div>
      <p className="mt-2 text-[10px] text-violet-800/90">
        Внутренний расчёт. Не отправляется гостю.
      </p>
    </div>
  );
}
