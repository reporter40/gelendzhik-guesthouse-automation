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

export type PricingRecommendation = {
  apartment_id: string;
  apartment_name: string;
  date_from: string;
  date_to: string;
  nights: number;
  current_price: number | null;
  market_median: number | null;
  recommended_price: number;
  recommendation_type: "gap_special_price" | "raise_price" | "lower_price" | "hold_price";
  reason: string;
  confidence: number | null;
  status: string;
};

export type CompetitorSource = {
  id: string;
  name: string;
  source_platform: string;
  url: string;
  address: string | null;
  district: string | null;
  similarity_score: number;
  priority: number;
  status: "active" | "excluded" | "archived" | "pending";
  property_type: string | null;
  area_m2: number | null;
  max_guests: number | null;
  rooms: number | null;
  distance_to_beach_m: number | null;
  distance_to_center_m: number | null;
  has_private_entrance: boolean | null;
  has_private_kitchen: boolean | null;
  has_balcony_or_terrace: boolean | null;
  amenities: Record<string, boolean>;
  min_stay: number | null;
  target_audience: string | null;
  price_low: number | null;
  price_high: number | null;
  selection_reason: string | null;
  exclusion_reason: string | null;
  last_checked_at: string | null;
  latest_price: number | null;
  last_observed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitorPriceObservation = {
  id: string;
  competitor_name: string;
  similarity_score: number;
  source_platform: string;
  competitor_url: string;
  observed_at: string;
  stay_date_from: string;
  stay_date_to: string;
  nights: number | null;
  price_per_night: number | null;
  confidence: number | null;
  collection_method: string;
  notes: string | null;
};

export type RevenueSummary = {
  total_gaps: number;
  total_estimated_loss: number;
  one_night_gaps: number;
  two_night_gaps: number;
  three_night_gaps: number;
  competitor_count: number;
  competitor_sources_count: number;
  active_competitors_count: number;
  excluded_competitors_count: number;
  market_min: number | null;
  market_median: number | null;
  market_avg: number | null;
  market_max: number | null;
  latest_market_min_from_sources: number | null;
  latest_market_median_from_sources: number | null;
  latest_market_avg_from_sources: number | null;
  latest_market_max_from_sources: number | null;
  recommendations_count: number;
};

export type RevenueData = {
  gap_windows: GapWindow[];
  competitor_prices: CompetitorPrice[];
  competitor_sources?: CompetitorSource[];
  latest_observations?: CompetitorPriceObservation[];
  pricing_recommendations: PricingRecommendation[];
  summary: RevenueSummary;
};

export type AddCompetitorPriceInput = {
  source: string;
  title: string;
  url?: string;
  location?: string;
  max_guests?: number;
  rooms?: number;
  date_from: string;
  date_to: string;
  price_per_night: number;
  rating?: number;
  reviews_count?: number;
  notes?: string;
};

export async function addCompetitorPrice(
  input: AddCompetitorPriceInput,
): Promise<{ ok: boolean; id: string; message: string }> {
  const API_URL_VAL = process.env.ADMIN_API_URL;
  const API_TOKEN_VAL = process.env.ADMIN_API_TOKEN;
  if (!API_URL_VAL) throw new AdminApiError("ADMIN_API_URL is not configured");
  if (!API_TOKEN_VAL) throw new AdminApiError("ADMIN_API_TOKEN is not configured");

  let res: Response;
  try {
    res = await fetch(API_URL_VAL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": API_TOKEN_VAL,
      },
      body: JSON.stringify({ action: "revenue_add_competitor_price", ...input }),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new AdminApiError(`Admin API unreachable: ${msg}`);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || (body && body.ok === false)) {
    const err = body?.error ?? `HTTP ${res.status}`;
    throw new AdminApiError(err, res.status);
  }
  return body as { ok: boolean; id: string; message: string };
}

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
