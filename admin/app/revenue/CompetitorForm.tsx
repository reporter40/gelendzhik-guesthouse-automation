"use client";

import { useActionState } from "react";
import { addCompetitorPriceAction, AddCompetitorState } from "./actions";

const initial: AddCompetitorState = { ok: false };

export default function CompetitorForm() {
  const [state, action, pending] = useActionState(addCompetitorPriceAction, initial);

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 select-none list-none flex items-center gap-2">
        <span className="text-indigo-600">＋</span> Добавить цену конкурента
      </summary>
      <form action={action} className="px-4 pb-4 pt-3 space-y-3">
        {state.ok && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            ✓ {state.message ?? "Добавлено"}
          </p>
        )}
        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field name="source"    label="Источник *"    placeholder="Авито, Booking, ЦИАН…" required />
          <Field name="title"     label="Название *"    placeholder="Домик у моря"           required />
          <Field name="url"       label="URL"           placeholder="https://…"              type="url" />
          <Field name="location"  label="Локация"       placeholder="Геленджик, центр" />
          <Field name="date_from" label="Дата от *"     type="date"   required />
          <Field name="date_to"   label="Дата до *"     type="date"   required />
          <Field name="price_per_night" label="₽/ночь *" placeholder="5500" type="number" required />
          <Field name="rating"    label="Рейтинг"       placeholder="4.8"  type="number" step="0.1" />
          <Field name="reviews_count" label="Отзывов"   placeholder="42"   type="number" />
          <Field name="max_guests"    label="Гостей"    placeholder="4"    type="number" />
          <Field name="rooms"         label="Комнат"    placeholder="2"    type="number" />
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Заметки</label>
            <textarea name="notes" rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Ближайший конкурент, похожий объект…" />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Сохраняем…" : "Добавить"}
        </button>
      </form>
    </details>
  );
}

function Field({
  name, label, placeholder, type = "text", required = false, step,
}: {
  name: string; label: string; placeholder?: string;
  type?: string; required?: boolean; step?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        name={name} type={type} placeholder={placeholder} required={required}
        step={step}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </div>
  );
}
