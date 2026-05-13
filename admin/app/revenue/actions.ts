"use server";

import { addCompetitorPrice, AdminApiError } from "@/lib/adminApi";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

export type AddCompetitorState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export async function addCompetitorPriceAction(
  _prev: AddCompetitorState,
  formData: FormData,
): Promise<AddCompetitorState> {
  await requireAuth();

  const raw = {
    source: formData.get("source")?.toString().trim() ?? "",
    title: formData.get("title")?.toString().trim() ?? "",
    url: formData.get("url")?.toString().trim() || undefined,
    location: formData.get("location")?.toString().trim() || undefined,
    max_guests: formData.get("max_guests") ? Number(formData.get("max_guests")) : undefined,
    rooms: formData.get("rooms") ? Number(formData.get("rooms")) : undefined,
    date_from: formData.get("date_from")?.toString() ?? "",
    date_to: formData.get("date_to")?.toString() ?? "",
    price_per_night: Number(formData.get("price_per_night")),
    rating: formData.get("rating") ? Number(formData.get("rating")) : undefined,
    reviews_count: formData.get("reviews_count")
      ? Number(formData.get("reviews_count"))
      : undefined,
    notes: formData.get("notes")?.toString().trim() || undefined,
  };

  if (!raw.source || !raw.title || !raw.date_from || !raw.date_to || !raw.price_per_night) {
    return { ok: false, error: "Заполни обязательные поля: источник, название, даты, цена" };
  }
  if (raw.price_per_night <= 0) {
    return { ok: false, error: "Цена должна быть больше 0" };
  }
  if (raw.date_to < raw.date_from) {
    return { ok: false, error: "Дата окончания не может быть раньше даты начала" };
  }

  try {
    const result = await addCompetitorPrice(raw);
    revalidatePath("/revenue");
    return { ok: true, message: result.message ?? "Добавлено" };
  } catch (e) {
    const msg = e instanceof AdminApiError ? e.message : "Ошибка сохранения";
    return { ok: false, error: msg };
  }
}
