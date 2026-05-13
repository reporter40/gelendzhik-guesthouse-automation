"use client";

import { useMemo, useState } from "react";

import type { BookingRow } from "@/lib/adminApi";

import CopyButton from "./CopyButton";

type Filter = "upcoming" | "past" | "all";

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDay(value: string): Date {
  const day = value.slice(0, 10);
  const [y, m, d] = day.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function filterBookings(list: BookingRow[], f: Filter): BookingRow[] {
  const today = startOfTodayLocal();
  if (f === "all") return list;
  return list.filter((b) => {
    const checkout = parseDay(b.checkout_at);
    if (Number.isNaN(checkout.getTime())) return true;
    if (f === "past") return checkout < today;
    // upcoming: checkout on or after today (includes in-house)
    return checkout >= today;
  });
}

function formatJourneySent(j: BookingRow["journey_sent"]) {
  if (!j || typeof j !== "object") return "—";
  const keys = Object.keys(j);
  if (keys.length === 0) return "—";
  return `${keys.length}`;
}

export default function BookingsTable({ bookings }: { bookings: BookingRow[] }) {
  const [filter, setFilter] = useState<Filter>("upcoming");

  const rows = useMemo(
    () => filterBookings(bookings, filter),
    [bookings, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">Показать:</span>
        {(
          [
            ["upcoming", "Предстоящие"],
            ["past", "Прошедшие"],
            ["all", "Все"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500">
          {rows.length} из {bookings.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "id",
                "Кв. №",
                "Объект",
                "Заезд",
                "Выезд",
                "Статус",
                "Источник",
                "Гость",
                "Telegram",
                "Guest app",
                "Journey",
                "Ссылка",
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/80">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-800">
                  {b.id}
                </td>
                <td className="px-3 py-2">{b.apartment_id}</td>
                <td className="px-3 py-2">{b.apartment_name}</td>
                <td className="whitespace-nowrap px-3 py-2">{b.checkin_at}</td>
                <td className="whitespace-nowrap px-3 py-2">{b.checkout_at}</td>
                <td className="px-3 py-2">{b.status}</td>
                <td className="px-3 py-2 text-gray-600">{b.source}</td>
                <td className="px-3 py-2">{b.guest_name ?? "—"}</td>
                <td className="px-3 py-2">{b.guest_username ?? "—"}</td>
                <td className="px-3 py-2">
                  {typeof b.guest_connected === "boolean"
                    ? b.guest_connected
                      ? "true"
                      : "false"
                    : "—"}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {formatJourneySent(b.journey_sent)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <CopyButton text={b.deep_link} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
