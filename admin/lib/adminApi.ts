const API_URL = process.env.ADMIN_API_URL;
const API_TOKEN = process.env.ADMIN_API_TOKEN;

export type AdminAction = "health" | "bookings" | "templates" | "revenue";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export type HealthData = {
  bookings_count: number;
  rc_bookings_count: number;
  templates_count: number;
  guest_connected_count: number;
  latest_rc_sync: string | null;
};

export type BookingRow = {
  id: string;
  apartment_id: string;
  apartment_name: string;
  checkin_at: string;
  checkout_at: string;
  status: string;
  source: string;
  guest_name: string | null;
  guest_username: string | null;
  guest_connected: boolean;
  journey_sent: Record<string, string> | null;
  deep_link: string;
};

export type TemplateRow = {
  key: string;
  channel: string;
  lang: string;
  body: string;
  active: boolean;
  updated_at: string;
};

export type GapWindow = {
  apartment_id: string;
  apartment_name: string;
  gap_start: string;
  gap_end: string;
  nights: number;
  estimated_loss: number | null;
  recommendation: string;
  status: string;
  detected_at: string;
};

export type CompetitorPrice = {
  source: string;
  title: string;
  url: string | null;
  location: string | null;
  date_from: string;
  date_to: string;
  price_per_night: number;
  rating: number | null;
  reviews_count: number | null;
  notes: string | null;
  collected_at: string;
};

export type RevenueSummary = {
  total_gaps: number;
  total_estimated_loss: number;
  one_night_gaps: number;
  two_night_gaps: number;
  three_night_gaps: number;
};

export type RevenueData = {
  gap_windows: GapWindow[];
  competitor_prices: CompetitorPrice[];
  summary: RevenueSummary;
};

export async function adminApi<A extends AdminAction>(
  action: A,
): Promise<
  A extends "health"
    ? HealthData
    : A extends "bookings"
      ? BookingRow[]
      : A extends "revenue"
        ? RevenueData
        : TemplateRow[]
> {
  if (!API_URL) {
    throw new AdminApiError("ADMIN_API_URL is not configured");
  }
  if (!API_TOKEN) {
    throw new AdminApiError("ADMIN_API_TOKEN is not configured");
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": API_TOKEN,
      },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new AdminApiError(`Admin API unreachable: ${msg}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${res.status}`;
    throw new AdminApiError(err, res.status);
  }

  if (
    body &&
    typeof body === "object" &&
    "ok" in body &&
    (body as { ok: unknown }).ok === false
  ) {
    const err =
      "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : "request_failed";
    throw new AdminApiError(err, res.status);
  }

  const data =
    body &&
    typeof body === "object" &&
    "data" in body &&
    (body as { data: unknown }).data !== undefined
      ? (body as { data: unknown }).data
      : body;

  return data as A extends "health"
    ? HealthData
    : A extends "bookings"
      ? BookingRow[]
      : A extends "revenue"
        ? RevenueData
        : TemplateRow[];
}
