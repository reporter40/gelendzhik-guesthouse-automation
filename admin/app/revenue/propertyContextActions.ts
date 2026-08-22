"use server";

import {
  getPropertyContextSettings,
  savePropertyContextSettings,
  AdminApiError,
} from "@/lib/adminApi";
import {
  normalizeDefaultPropertyContext,
  normalizePropertyContextMapFromJsonText,
} from "@/lib/property-context-settings";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "./actions";

export async function reloadPropertyContextSettingsAction(): Promise<{
  ok: boolean;
  mapText?: string;
  defaultContext?: string;
  error?: string;
}> {
  await requireAuth();
  try {
    const d = await getPropertyContextSettings();
    return {
      ok: true,
      mapText: JSON.stringify(d.property_context_map ?? {}, null, 2),
      defaultContext: d.default_property_context ?? "",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof AdminApiError ? e.message : "Ошибка загрузки PCS",
    };
  }
}

export async function savePropertyContextSettingsFieldsAction(
  mapJsonText: string,
  defaultContext: string,
): Promise<ActionState> {
  await requireAuth();
  const parsed = normalizePropertyContextMapFromJsonText(mapJsonText);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const def = normalizeDefaultPropertyContext(defaultContext);
  try {
    const saved = await savePropertyContextSettings({
      property_context_map: parsed.map,
      default_property_context: def,
    });
    revalidatePath("/revenue");
    const message = saved.audit_recorded
      ? "Сохранено. Изменения записаны в аудит."
      : (saved.message ?? "Сохранено");
    return { ok: true, message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof AdminApiError ? e.message : "Ошибка сохранения",
    };
  }
}
