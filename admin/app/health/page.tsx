import { adminApi, type HealthData } from "@/lib/adminApi";
import { requireAuth } from "@/lib/session";
import Nav from "@/components/Nav";

function Indicator({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        ok ? "bg-green-500" : "bg-red-500"
      }`}
      aria-hidden
    />
  );
}

function StatCard({
  label,
  value,
  ok,
}: {
  label: string;
  value: string | number;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="pt-1">
        <Indicator ok={ok} />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-gray-900">
          {value}
        </p>
      </div>
    </div>
  );
}

export default async function HealthPage() {
  await requireAuth();

  let error: string | null = null;
  let data: HealthData | null = null;

  try {
    data = await adminApi("health");
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Не удалось получить статус системы.";
  }

  const h = data;
  const bookingsOk = h != null && typeof h.bookings_count === "number";
  const rcOk = h != null && typeof h.rc_bookings_count === "number";
  const templatesOk = h != null && typeof h.templates_count === "number";
  const guestConnOk =
    h != null && typeof h.guest_connected_count === "number";
  const syncOk =
    h != null &&
    h.latest_rc_sync != null &&
    String(h.latest_rc_sync).length > 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Состояние (Admin API)
        </h1>
        {error && (
          <div
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="bookings_count"
            value={h?.bookings_count ?? "—"}
            ok={bookingsOk}
          />
          <StatCard
            label="rc_bookings_count"
            value={h?.rc_bookings_count ?? "—"}
            ok={rcOk}
          />
          <StatCard
            label="templates_count"
            value={h?.templates_count ?? "—"}
            ok={templatesOk}
          />
          <StatCard
            label="guest_connected_count"
            value={h?.guest_connected_count ?? "—"}
            ok={guestConnOk}
          />
          <div className="sm:col-span-2">
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="pt-1">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    syncOk ? "bg-green-500" : "bg-red-500"
                  }`}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">latest_rc_sync</p>
                <p className="break-all text-lg font-semibold text-gray-900">
                  {h?.latest_rc_sync ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
