"use client";

import type { RevenueDashboardSummary, RevenueDashboardTopRec } from "@/lib/adminApi";

function fmt(n: number | null | undefined, fallback = "—") {
  if (n == null || isNaN(n as number)) return fallback;
  return (n as number).toLocaleString("ru-RU");
}

type Props = {
  summary: RevenueDashboardSummary | null | undefined;
  previewRec: RevenueDashboardTopRec | null | undefined;
};

export function DirectBookingStrategyPanel({ summary, previewRec }: Props) {
  const enabled = summary?.direct_booking_enabled !== false;
  const markup = summary?.aggregator_markup_percent ?? 18;
  const discount = summary?.direct_discount_percent ?? 5;

  const guest = previewRec?.recommended_guest_price ?? previewRec?.recommended_price;
  const guestOnOta = previewRec?.expected_aggregator_guest_price;
  const direct = previewRec?.direct_price;
  const guestSave = previewRec?.direct_savings_for_guest;
  const ownerGain = previewRec?.direct_owner_gain;

  const showNumbers =
    guest != null &&
    direct != null &&
    guestSave != null &&
    ownerGain != null &&
    (guestOnOta != null || guest != null);

  return (
    <div
      className="rounded-2xl border px-6 py-5 mt-8"
      style={{ background: "#F5FAFF", borderColor: "#B8D4F0" }}
    >
      <h3 className="text-lg font-semibold mb-2" style={{ color: "#072B55" }}>
        Прямая продажа без посредника
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed max-w-3xl mb-4">
        Когда канал уже показал гостю «цену после наценки», прямое предложение может дать тем же параметрам более низкую цену для гостя и больше владельцу — без комиссии площадки. Сценарии автосообщений не запускались (
        {!enabled ? "режим выключен в конфигурации" : "CTA ниже заглушки"}).
      </p>
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-white border border-gray-200 px-4 py-3">
          <dt className="text-gray-500 text-xs uppercase tracking-wide">Профиль канала</dt>
          <dd className="text-gray-800 mt-1">
            Наценка агрегатора (~{fmt(markup, "?")}%): net в RC ниже видимого гостевого ориентира по рынку.
          </dd>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 px-4 py-3">
          <dt className="text-gray-500 text-xs uppercase tracking-wide">Скидка прямого предложения</dt>
          <dd className="text-gray-800 mt-1">
            По умолчанию ~{fmt(discount, "?")}% от гостевой цели (настраивается в system_vars direct_discount_percent).
          </dd>
        </div>
      </dl>
      {previewRec && showNumbers && (
        <div className="mt-4 rounded-lg bg-white border border-teal-200 px-4 py-3 text-sm text-gray-800">
          <p className="text-xs uppercase tracking-wide text-teal-800 font-semibold mb-2">
            Пример (топ‑рекомендация из дашборда, №{previewRec.apartment_id})
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Гость на агрегаторе ~{guestOnOta != null ? fmt(guestOnOta) : fmt(guest)} ₽/ночь; прямо ~{fmt(direct)} ₽.
            </li>
            <li>
              Гость может сэкономить ~{fmt(guestSave)} ₽; владелец получает больше примерно на ~{fmt(ownerGain)} ₽
              относительно net ставки RC.
            </li>
          </ul>
        </div>
      )}
      {!previewRec && (
        <p className="text-xs text-gray-400 mt-3">Пример расчётов появится после пересчёта рекомендаций.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-400 cursor-not-allowed"
          title="См. Phase C3.8 — отправка сообщений пока отключена"
        >
          Сгенерировать прямое предложение
        </button>
        <button
          type="button"
          disabled
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-400 cursor-not-allowed"
          title="См. Phase C3.8 — без автокопирования текста Telegram"
        >
          Скопировать текст для Telegram
        </button>
      </div>
    </div>
  );
}
