#!/usr/bin/env python3
"""
C3.6 — Recalculate Pricing Recommendations after Cohort Expansion
Replicates the exact logic of n8n Workflow 12 (12_pricing_recommender.json).

Actions:
  1. Load gap windows (open, future)
  2. Load background market (competitor_prices)
  3. Load cohort-aware market data (competitor_sources + observations)
  4. Calculate recommendations using the same JS logic (translated to Python)
  5. Before upsert: reset apt #50's apply_failed → draft (it has wrong cohort data)
  6. Upsert recommendations — only overwrites draft status records
  7. Print before/after comparison

Safe constraints:
  - Never writes to RealtyCalendar
  - Never changes real prices or bookings
  - Only touches pricing_recommendations table
  - Only overwrites records with status='draft'
  - apply_failed for apt #50 reset to draft ONLY to allow recalc with correct cohort
"""
import psycopg2
import json
import math
from datetime import datetime, timezone

# ── DB connection ─────────────────────────────────────────────────────────────
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    dbname="n8n_gelendzhik",
    user="n8n_user",
    password=""  # auth via pg_hba.conf (trust/md5 local)
)
conn.autocommit = False
cur = conn.cursor()

print("=" * 70)
print("C3.6 — Recalculate Recommendations After Cohort Expansion")
print(f"Started: {datetime.now(timezone.utc).isoformat()}")
print("=" * 70)

# ── Step 0: Show current state before changes ────────────────────────────────
print("\n[BEFORE] Current pricing_recommendations:")
cur.execute("""
    SELECT apartment_id, date_from::DATE, date_to::DATE, nights,
           current_price, market_median, recommended_price,
           recommendation_type, confidence, status,
           LEFT(reason, 100) AS reason
    FROM pricing_recommendations
    ORDER BY apartment_id, date_from
""")
rows_before = cur.fetchall()
cols = ['apt', 'from', 'to', 'n', 'curr_price', 'mkt_median', 'rec_price',
        'type', 'conf', 'status', 'reason']
print(f"  {'apt':>4} {'from':>12} {'n':>2} {'curr':>6} {'mkt':>7} {'rec':>6} {'conf':>5} {'status':>14}")
print("  " + "-"*65)
for r in rows_before:
    print(f"  {str(r[0]):>4} {str(r[1]):>12} {str(r[3]):>2} {str(r[4]):>6} "
          f"{str(r[5]):>7} {str(r[6]):>6} {str(r[9]):>5} {str(r[10]):>14}")
    print(f"       reason: {r[11][:80]}")

# ── Step 1: Reset apt #50 apply_failed → draft ───────────────────────────────
# The apply_failed record has wrong cohort data (market_median=6500, wrong cohort).
# Resetting to draft allows the upsert to overwrite with correct large_family data.
# The backup at /opt/backups/c36_recalc_20260514_214209/ preserves the original state.
print("\n[STEP 1] Reset apt #50 apply_failed → draft for recalculation...")
cur.execute("""
    UPDATE pricing_recommendations
    SET status = 'draft',
        updated_at = NOW()
    WHERE apartment_id = '50'
      AND status = 'apply_failed'
    RETURNING id, apartment_id, date_from, status
""")
reset_rows = cur.fetchall()
for r in reset_rows:
    print(f"  Reset: apt={r[1]} date={r[2]} → draft")
if not reset_rows:
    print("  Nothing to reset (no apply_failed for apt 50)")

# ── Step 2: Load gap windows ──────────────────────────────────────────────────
print("\n[STEP 2] Loading gap windows...")
cur.execute("""
    SELECT gw.id AS gap_id, gw.apartment_id, a.name AS apartment_name,
           a.base_price,
           gw.gap_start AS date_from,
           gw.gap_end   AS date_to,
           gw.nights,
           gw.estimated_loss
    FROM gap_windows gw
    JOIN apartments a ON a.id = gw.apartment_id
    WHERE gw.status = 'open'
      AND gw.gap_start >= CURRENT_DATE
    ORDER BY gw.gap_start
""")
gaps = []
for r in cur.fetchall():
    gaps.append({
        'gap_id': r[0], 'apartment_id': r[1], 'apartment_name': r[2],
        'base_price': float(r[3]) if r[3] else 6000,
        'date_from': str(r[4]), 'date_to': str(r[5]),
        'nights': int(r[6]) if r[6] else 0,
        'estimated_loss': float(r[7]) if r[7] else None,
        'status': 'open'
    })
print(f"  Found {len(gaps)} open gap windows")
for g in gaps:
    print(f"  Apt {g['apartment_id']}: {g['date_from']}–{g['date_to']} ({g['nights']} nights)")

# ── Step 3: Load background market ───────────────────────────────────────────
print("\n[STEP 3] Loading background market (competitor_prices)...")
cur.execute("""
    SELECT AVG(price_per_night) AS bg_avg,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_night) AS bg_median,
           COUNT(*) AS bg_count
    FROM competitor_prices
    WHERE date_from <= CURRENT_DATE + INTERVAL '90 days'
      AND date_to >= CURRENT_DATE
""")
bg_row = cur.fetchone()
bg_median = float(bg_row[1]) if bg_row and bg_row[1] else None
print(f"  Background median: {bg_median}, count: {bg_row[2] if bg_row else 0}")

# ── Step 4: Load cohort-aware market data ─────────────────────────────────────
print("\n[STEP 4] Loading cohort-aware competitor data...")
cur.execute("""
WITH cohort_sources AS (
  SELECT
    cs.id, cs.name,
    cs.similarity_score, cs.signal_quality_score,
    cs.status, cs.is_static_price,
    cs.cohort_code, cs.target_apartment_ids,
    cpo.price_per_night, cpo.observed_at, cpo.observation_quality,
    cpo.confidence AS obs_confidence,
    (NOW() - cpo.observed_at) AS age_interval,
    CASE
      WHEN (NOW() - cpo.observed_at) <= INTERVAL '14 days' THEN 1.0
      WHEN (NOW() - cpo.observed_at) <= INTERVAL '30 days' THEN 0.7
      WHEN (NOW() - cpo.observed_at) <= INTERVAL '60 days' THEN 0.4
      ELSE 0.2
    END AS recency_weight,
    CASE WHEN (NOW() - cpo.observed_at) > INTERVAL '14 days' THEN TRUE ELSE FALSE END AS is_stale
  FROM competitor_sources cs
  JOIN LATERAL (
    SELECT * FROM competitor_price_observations
    WHERE competitor_source_id = cs.id
    ORDER BY observed_at DESC LIMIT 1
  ) cpo ON TRUE
  WHERE cs.status IN ('active', 'approved')
    AND cs.discovery_status IN ('seeded', 'approved')
    AND cs.similarity_score >= 80
    AND cs.cohort_code IS NOT NULL
    AND cs.cohort_code != 'gelendzhik_background_market'
),
weighted AS (
  SELECT *,
    (similarity_score / 100.0)
    * signal_quality_score
    * recency_weight
    * CASE WHEN is_static_price THEN 0.5 ELSE 1.0 END AS final_weight
  FROM cohort_sources
)
SELECT
  cohort_code,
  COUNT(*) AS source_count,
  MIN(price_per_night) AS market_min,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_night) AS market_median,
  SUM(price_per_night * final_weight) / NULLIF(SUM(final_weight), 0) AS weighted_avg,
  MAX(price_per_night) AS market_max,
  bool_or(is_stale) AS has_stale_data,
  COUNT(*) FILTER (WHERE NOT is_stale) AS fresh_count,
  json_agg(json_build_object(
    'name', name,
    'similarity_score', similarity_score,
    'signal_quality_score', signal_quality_score,
    'price_per_night', price_per_night,
    'is_stale', is_stale,
    'is_static_price', is_static_price,
    'final_weight', final_weight,
    'cohort_code', cohort_code
  )) AS source_details
FROM weighted
GROUP BY cohort_code
""")

cohort_data = {}
for r in cur.fetchall():
    code = r[0]
    sources = r[8] if r[8] else []
    if isinstance(sources, str):
        sources = json.loads(sources)
    cohort_data[code] = {
        'cohort_code': code,
        'source_count': int(r[1]),
        'market_min': float(r[2]) if r[2] else None,
        'median': float(r[3]) if r[3] else None,
        'weighted_avg': float(r[4]) if r[4] else None,
        'max': float(r[5]) if r[5] else None,
        'has_stale': bool(r[6]),
        'fresh_count': int(r[7]),
        'sources': sources,
        'from_background': False
    }
    print(f"  Cohort: {code}")
    print(f"    sources={r[1]}, fresh={r[7]}, median={r[3]}, min={r[2]}, max={r[5]}")

# ── Step 5: Calculate recommendations (same JS logic translated to Python) ────
print("\n[STEP 5] Calculating recommendations...")

APARTMENT_COHORTS = {
    40: ['standard_family_2room'],
    41: ['standard_family_2room'],
    42: ['standard_family_2room'],
    50: ['large_family_house_territory']
}
APT_50_MIN_SOURCES = 3

def get_market_for_apt(apt_id):
    cohorts = APARTMENT_COHORTS.get(apt_id, ['standard_family_2room'])
    for code in cohorts:
        cd = cohort_data.get(code)
        if cd and (cd['median'] or cd['weighted_avg']) and cd['source_count'] > 0:
            return {**cd, 'cohort_code': code, 'from_background': False}
    return {
        'median': bg_median, 'weighted_avg': bg_median,
        'min': None, 'max': None, 'fresh_count': 0, 'source_count': 0,
        'has_stale': True, 'sources': [],
        'cohort_code': 'gelendzhik_background_market', 'from_background': True
    }

# Build apt base prices
apt_prices = {}
for g in gaps:
    if g.get('estimated_loss') and g['nights'] and g['apartment_id'] not in apt_prices:
        apt_prices[g['apartment_id']] = round(g['estimated_loss'] / g['nights'])

recs = []
for gap in gaps:
    if gap.get('status', 'open') != 'open':
        continue
    nights = gap['nights']
    if nights < 1 or nights > 3:
        continue

    apt_id = int(gap['apartment_id'])
    base_price = apt_prices.get(gap['apartment_id'], gap.get('base_price', 6000))
    market = get_market_for_apt(apt_id)
    has_market = market['median'] is not None
    is_apt50 = apt_id == 50

    # Confidence
    if is_apt50:
        large_sources = market['source_count'] if market['cohort_code'] == 'large_family_house_territory' else 0
        if large_sources < APT_50_MIN_SOURCES:
            confidence = 0.40
        elif market['fresh_count'] >= 2:
            confidence = 0.72
        else:
            confidence = 0.55
    elif not has_market or market['from_background']:
        confidence = 0.35
    elif market['fresh_count'] == 0:
        confidence = 0.42 if market['has_stale'] else 0.45
    elif market['fresh_count'] >= 3:
        confidence = 0.78
    elif market['fresh_count'] >= 2:
        confidence = 0.72
    else:
        confidence = 0.60

    if market['has_stale'] and market['fresh_count'] == 0:
        confidence = min(confidence, 0.50)
    if market['from_background']:
        confidence = min(confidence, 0.38)

    market_median = market['median'] or market['weighted_avg']
    market_min    = market['min']
    market_max    = market['max']
    market_avg    = market['weighted_avg'] or market['median']

    # Recommended price
    if not has_market or market['from_background']:
        recommended_price   = round(base_price * 0.92)
        recommendation_type = 'discount_no_market'
    else:
        ref_price = market_median or base_price
        gap_factor = 0.90 if nights == 1 else (0.93 if nights == 2 else 0.95)
        recommended_price   = round(ref_price * gap_factor)
        recommendation_type = ('gap_fill_aggressive' if nights == 1
                               else 'gap_fill_moderate' if nights == 2
                               else 'gap_fill_soft')

    # Reason string
    cohort_labels = {
        'standard_family_2room':        'кластер стандарт 4–5 гостей',
        'large_family_house_territory': 'кластер крупные объекты 6–8 гостей',
        'gelendzhik_background_market': 'фоновый рынок'
    }
    cohort_label = cohort_labels.get(market['cohort_code'], market['cohort_code'])

    active_names = ', '.join([
        s['name'].replace('Двухкомнатная квартира ', '').replace('Этаж под ключ ', 'Этаж ')
        for s in (market.get('sources') or [])
        if (s.get('final_weight') or 0) > 0.2
    ][:3])

    if is_apt50:
        large_sources = market['source_count'] if market['cohort_code'] == 'large_family_house_territory' else 0
        if large_sources < APT_50_MIN_SOURCES:
            reason = (f"Для объекта №50 недостаточно прямых конкурентов крупного формата "
                     f"(есть {large_sources} из мин. {APT_50_MIN_SOURCES}); рекомендация предварительная.")
        else:
            reason = (f"Объект №50, {cohort_label}. Рыночная медиана: {round(market_median)} ₽. "
                     f"Источников: {market['source_count']} (свежих: {market['fresh_count']}).")
    elif market['from_background']:
        reason = (f"Недостаточно данных по {cohort_label}. Скидка от базовой цены. "
                  f"Добавьте конкурентов для повышения точности.")
    else:
        stale_note = (' Данные устарели, требуют обновления.'
                      if market['has_stale'] and market['fresh_count'] == 0 else '')
        reason = (f"Окно {nights} н. ({gap['date_from']}–{gap['date_to']}). "
                  f"Рынок {cohort_label}: медиана {round(market_median)} ₽."
                  + (f" Конкуренты: {active_names}." if active_names else '')
                  + stale_note)

    conf_rounded = round(confidence * 100) / 100

    recs.append({
        'apartment_id': str(gap['apartment_id']),
        'date_from': gap['date_from'],
        'date_to': gap['date_to'],
        'nights': nights,
        'current_price': round(base_price),
        'market_min': round(market_min) if market_min else None,
        'market_median': round(market_median) if market_median else None,
        'market_avg': round(market_avg) if market_avg else None,
        'market_max': round(market_max) if market_max else None,
        'recommended_price': recommended_price,
        'recommendation_type': recommendation_type,
        'reason': reason,
        'confidence': conf_rounded,
        'source': f"cohort:{market['cohort_code']}"
    })

print(f"\n  Calculated {len(recs)} recommendations:")
for r in recs:
    print(f"  Apt {r['apartment_id']:>3}: {r['date_from']} {r['nights']}n "
          f"| mkt_median={r['market_median']} rec={r['recommended_price']} "
          f"conf={r['confidence']} type={r['recommendation_type']}")
    print(f"           reason: {r['reason'][:100]}")

# ── Step 6: Upsert recommendations (only draft) ───────────────────────────────
print("\n[STEP 6] Upserting recommendations (draft only)...")

UPSERT_SQL = """
INSERT INTO pricing_recommendations
  (apartment_id, date_from, date_to, nights, current_price,
   market_min, market_median, market_avg, market_max,
   recommended_price, recommendation_type, reason,
   confidence, source, status)
VALUES (%s, %s::date, %s::date, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
ON CONFLICT (apartment_id, date_from)
DO UPDATE SET
  date_to              = EXCLUDED.date_to,
  nights               = EXCLUDED.nights,
  current_price        = EXCLUDED.current_price,
  market_min           = EXCLUDED.market_min,
  market_median        = EXCLUDED.market_median,
  market_avg           = EXCLUDED.market_avg,
  market_max           = EXCLUDED.market_max,
  recommended_price    = EXCLUDED.recommended_price,
  recommendation_type  = EXCLUDED.recommendation_type,
  reason               = EXCLUDED.reason,
  confidence           = EXCLUDED.confidence,
  source               = EXCLUDED.source,
  updated_at           = NOW()
WHERE pricing_recommendations.status = 'draft'
RETURNING apartment_id, date_from, recommended_price, recommendation_type,
          confidence, market_median, source
"""

upserted = []
for rec in recs:
    cur.execute(UPSERT_SQL, (
        rec['apartment_id'], rec['date_from'], rec['date_to'], rec['nights'],
        rec['current_price'], rec['market_min'], rec['market_median'],
        rec['market_avg'], rec['market_max'], rec['recommended_price'],
        rec['recommendation_type'], rec['reason'], rec['confidence'], rec['source']
    ))
    rows = cur.fetchall()
    upserted.extend(rows)

for r in upserted:
    print(f"  Upserted: apt={r[0]} date={r[1]} rec_price={r[2]} "
          f"conf={r[4]} median={r[5]} source={r[6]}")

if not upserted:
    print("  WARNING: No rows upserted! Check if any recs have status='draft'")

# ── Step 7: Show AFTER state ──────────────────────────────────────────────────
print("\n[AFTER] pricing_recommendations:")
cur.execute("""
    SELECT apartment_id, date_from::DATE, date_to::DATE, nights,
           current_price, market_median, recommended_price,
           recommendation_type, confidence, status,
           LEFT(reason, 120) AS reason
    FROM pricing_recommendations
    ORDER BY apartment_id, date_from
""")
rows_after = cur.fetchall()
print(f"  {'apt':>4} {'from':>12} {'n':>2} {'curr':>6} {'mkt':>7} {'rec':>6} {'conf':>5} {'status':>14}")
print("  " + "-"*65)
for r in rows_after:
    print(f"  {str(r[0]):>4} {str(r[1]):>12} {str(r[3]):>2} {str(r[4]):>6} "
          f"{str(r[5]):>7} {str(r[6]):>6} {str(r[9]):>5} {str(r[10]):>14}")
    print(f"       reason: {r[11][:110]}")

# ── Step 8: Commit ────────────────────────────────────────────────────────────
conn.commit()
print("\n✅ Transaction committed.")
print(f"\nSummary:")
print(f"  Recommendations upserted: {len(upserted)}")
print(f"  Backup at: /opt/backups/c36_recalc_20260514_214209/tables.sql")
print(f"  Workflow 12 schedule: unchanged (still on daily cron)")

cur.close()
conn.close()
