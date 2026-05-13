import { adminApi, type BookingRow } from "@/lib/adminApi";
import BookingsTable from "@/components/BookingsTable";
import Nav from "@/components/Nav";
import { requireAuth } from "@/lib/session";

export default async function BookingsPage() {
  await requireAuth();

  let error: string | null = null;
  let bookings: BookingRow[] = [];

  try {
    bookings = await adminApi("bookings");
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Не удалось загрузить список броней.";
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Брони</h1>
        {error && (
          <div
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        <BookingsTable bookings={bookings} />
      </main>
    </>
  );
}
