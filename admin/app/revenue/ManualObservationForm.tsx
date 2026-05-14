"use client";

import { useActionState } from "react";
import { addObservationAction } from "./actions";
import type { ActionState } from "./actions";
import type { CompetitorSource } from "@/lib/adminApi";

const initial: ActionState = { ok: false };

export function ManualObservationForm({ sources }: { sources: CompetitorSource[] }) {
  const [state, action, pending] = useActionState(addObservationAction, initial);

  const activeSources = sources.filter((s) => s.status === "active");

  return (
    <details className="rounded-lg border border-indigo-100 bg-indigo-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-indigo-700 select-none list-none flex items-center gap-2">
        <span className="text-indigo-500 font-bold">＋</span> Добавить наблюдение вручную
      </summary>
      <form action={action} className="px-4 pb-4 pt-3 space-y-3">
        {state.ok && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            ✓ {state.message ?? "Наблюдение добавлено"}
          </p>
        )}
        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Competitor source dropdown */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Конкурент *</label>
            <select
              name="competitor_source_id"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— выбери конкурента —</option>
              {activeSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.similarity_score}% сходство)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Период (от) *</label>
            <input
              name="stay_date_from"
              type="date"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Период (до) *</label>
            <input
              name="stay_date_to"
              type="date"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">₽/ночь *</label>
            <input
              name="price_per_night"
              type="number"
              required
              placeholder="5500"
              min="1"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Заметки</label>
            <input
              name="notes"
              type="text"
              placeholder="Источник, контекст, откуда цена…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Наблюдение сохранится с методом «ручной ввод», уверенность 0.7, время — сейчас.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Сохраняем…" : "Добавить наблюдение"}
        </button>
      </form>
    </details>
  );
}
