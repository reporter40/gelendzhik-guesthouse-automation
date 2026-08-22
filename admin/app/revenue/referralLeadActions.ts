"use server";

import { saveManualReferralLead, AdminApiError } from "@/lib/adminApi";
import {
  buildManualReferralLeadPrefillFromRecommendation,
  prepareManualReferralLeadForSave,
  type ManualReferralLeadRawInput,
} from "@/lib/manual-referral-lead";
import type { PricingRecommendation } from "@/lib/adminApi";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "./actions";

export async function saveManualReferralLeadAction(
  rec: PricingRecommendation,
  form: {
    referrer_name: string;
    referrer_contact: string;
    referred_guest_name: string;
    referred_guest_contact: string;
    notes: string;
  },
): Promise<ActionState> {
  await requireAuth();

  const prefill = buildManualReferralLeadPrefillFromRecommendation(rec);
  const raw: ManualReferralLeadRawInput = {
    ...prefill,
    referrer_name: form.referrer_name,
    referrer_contact: form.referrer_contact,
    referred_guest_name: form.referred_guest_name,
    referred_guest_contact: form.referred_guest_contact,
    notes: form.notes,
  };

  const prepared = prepareManualReferralLeadForSave(raw);
  if (!prepared.ok) {
    return { ok: false, error: prepared.error };
  }

  try {
    const saved = await saveManualReferralLead(prepared.value);
    revalidatePath("/revenue");
    return {
      ok: true,
      message: saved.audit_recorded
        ? "Referral lead saved to audit log."
        : "Referral lead saved.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof AdminApiError ? e.message : "Ошибка сохранения",
    };
  }
}
