
// ── Inputs ─────────────────────────────────────────────────────────────────
const gaps        = $('Load Gap Windows').all().map(i => i.json);
const bgRows      = $('Load Market Data').all().map(i => i.json);
const cohortRows  = $('Load Competitor Sources').all().map(i => i.json);

const varRows = $('Load Pricing Vars').all().map(i => i.json);
const varMap = {};
for (const row of varRows) {
  if (row.key) varMap[row.key] = row.value;
}
function numVar(key, def) {
  const raw = varMap[key];
  if (raw == null || raw === '') return def;
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : def;
}
const aggregator_markup_percent = numVar('aggregator_markup_percent', 18);
const direct_discount_percent = numVar('direct_discount_percent', 5);

// ── Build per-cohort market data ─────────────────────────────────────────
const cohortData = {};
for (const row of cohortRows) {
  cohortData[row.cohort_code] = {
    median:       row.market_median    ? parseFloat(row.market_median)    : null,
    weightedAvg:  row.weighted_avg     ? parseFloat(row.weighted_avg)     : null,
    min:          row.market_min       ? parseFloat(row.market_min)       : null,
    max:          row.market_max       ? parseFloat(row.market_max)       : null,
    freshCount:   row.fresh_count      ? parseInt(row.fresh_count)        : 0,
    sourceCount:  row.source_count     ? parseInt(row.source_count)       : 0,
    hasStale:     row.has_stale_data   === true,
    sources:      row.source_details   || []
  };
}

// ── Background market ────────────────────────────────────────────────────
const bg = bgRows[0] || {};
const bgMedian = bg.bg_median ? parseFloat(bg.bg_median) : null;

// ── Cohort assignment by apartment ──────────────────────────────────────
const APARTMENT_COHORTS = {
  40: ['standard_family_2room'],
  41: ['standard_family_2room'],
  42: ['standard_family_2room'],
  50: ['large_family_house_territory']
};
const APT_50_MIN_SOURCES = 3;

// ── Helper: get market stats for apartment ────────────────────────────────
function getMarketForApt(aptId) {
  const cohorts = APARTMENT_COHORTS[aptId] || ['standard_family_2room'];
  for (const code of cohorts) {
    const cd = cohortData[code];
    if (cd && (cd.median || cd.weightedAvg) && cd.sourceCount > 0) {
      return { ...cd, cohort_code: code, from_background: false };
    }
  }
  return {
    median:      bgMedian,
    weightedAvg: bgMedian,
    min:         null,
    max:         null,
    freshCount:  0,
    sourceCount: 0,
    hasStale:    true,
    sources:     [],
    cohort_code: 'gelendzhik_background_market',
    from_background: true
  };
}

// ── Base prices from gap data ────────────────────────────────────────────
const aptPrices = {};
for (const g of gaps) {
  if (g.estimated_loss && g.nights && !aptPrices[g.apartment_id]) {
    aptPrices[g.apartment_id] = Math.round(g.estimated_loss / g.nights);
  }
}

const recs = [];

for (const gap of gaps) {
  if (gap.status != null && gap.status !== 'open') continue;
  const nights = parseInt(gap.nights);
  if (nights < 1 || nights > 3) continue;

  const aptId      = parseInt(gap.apartment_id);
  const base_price = aptPrices[aptId] || (gap.base_price ? parseFloat(gap.base_price) : 6000);
  const market     = getMarketForApt(aptId);
  const hasMarket  = market.median !== null;
  const isApt50    = aptId === 50;

  let confidence;

  if (isApt50) {
    const largeSources = market.cohort_code === 'large_family_house_territory'
      ? market.sourceCount : 0;
    if (largeSources < APT_50_MIN_SOURCES) {
      confidence = 0.40;
    } else if (market.freshCount >= 2) {
      confidence = 0.72;
    } else {
      confidence = 0.55;
    }
  } else if (!hasMarket || market.from_background) {
    confidence = 0.35;
  } else if (market.freshCount === 0) {
    confidence = market.hasStale ? 0.42 : 0.45;
  } else if (market.freshCount >= 3) {
    confidence = 0.78;
  } else if (market.freshCount >= 2) {
    confidence = 0.72;
  } else {
    confidence = 0.60;
  }

  if (market.hasStale && market.freshCount === 0) {
    confidence = Math.min(confidence, 0.50);
  }
  if (market.from_background) {
    confidence = Math.min(confidence, 0.38);
  }

  const market_median  = market.median || market.weightedAvg || null;
  const market_min     = market.min;
  const market_max     = market.max;
  const market_avg     = market.weightedAvg || market.median || null;

  let recommended_price;
  let recommendation_type;

  if (!hasMarket || market.from_background) {
    recommended_price    = Math.round(base_price * 0.92);
    recommendation_type  = 'discount_no_market';
  } else {
    const ref_price  = market_median || base_price;
    const gap_factor = nights === 1 ? 0.90 : nights === 2 ? 0.93 : 0.95;
    recommended_price   = Math.round(ref_price * gap_factor);
    recommendation_type = nights === 1 ? 'gap_fill_aggressive'
                        : nights === 2 ? 'gap_fill_moderate'
                        : 'gap_fill_soft';
  }

  const cohortLabel = {
    standard_family_2room:        'кластер стандарт 4–5 гостей',
    large_family_house_territory: 'кластер крупные объекты 6–8 гостей',
    gelendzhik_background_market: 'фоновый рынок'
  }[market.cohort_code] || market.cohort_code;

  const activeNames = (market.sources || [])
    .filter(s => s.final_weight > 0.2)
    .map(s => s.name.replace('Двухкомнатная квартира ', '').replace('Этаж под ключ ', 'Этаж '))
    .slice(0, 3)
    .join(', ');

  let reason = '';
  if (isApt50) {
    const largeSources = market.cohort_code === 'large_family_house_territory'
      ? market.sourceCount : 0;
    if (largeSources < APT_50_MIN_SOURCES) {
      reason = `Для объекта №50 недостаточно прямых конкурентов крупного формата (есть ${largeSources} из мин. ${APT_50_MIN_SOURCES}); рекомендация предварительная.`;
    } else {
      reason = `Объект №50, ${cohortLabel}. Рыночная медиана: ${Math.round(market_median)} ₽. Источников: ${market.sourceCount} (свежих: ${market.freshCount}).`;
    }
  } else if (market.from_background) {
    reason = `Недостаточно данных по ${cohortLabel}. Скидка от базовой цены. Добавьте конкурентов для повышения точности.`;
  } else {
    const staleNote = market.hasStale && market.freshCount === 0
      ? ' Данные устарели, требуют обновления.' : '';
    reason = `Окно ${nights} н. (${gap.date_from}–${gap.date_to}). Рынок ${cohortLabel}: медиана ${Math.round(market_median)} ₽.`
      + (activeNames ? ` Конкуренты: ${activeNames}.` : '')
      + staleNote;
  }

  const recommended_guest_price = recommended_price;
  const rc_net_price = Math.round(recommended_guest_price / (1 + aggregator_markup_percent / 100));
  const expected_aggregator_guest_price = Math.round(rc_net_price * (1 + aggregator_markup_percent / 100));
  const direct_price = Math.round(recommended_guest_price * (1 - direct_discount_percent / 100));
  const direct_savings_for_guest = expected_aggregator_guest_price - direct_price;
  const direct_owner_gain = direct_price - rc_net_price;

  reason += ` Цена ${recommended_guest_price} ₽ — ориентир для гостя (как на агрегаторе после наценки). Для RealtyCalendar с учётом ${Math.round(aggregator_markup_percent)}% наценки агрегатора рекомендуется поставить ${rc_net_price} ₽ (net).`;

  recs.push({
    json: {
      apartment_id:       gap.apartment_id,
      date_from:          gap.date_from,
      date_to:            gap.date_to,
      nights,
      current_price:      base_price,
      market_min:         market_min ? Math.round(market_min) : null,
      market_median:      market_median ? Math.round(market_median) : null,
      market_avg:         market_avg ? Math.round(market_avg) : null,
      market_max:         market_max ? Math.round(market_max) : null,
      recommended_price:  recommended_guest_price,
      recommended_guest_price,
      rc_net_price,
      aggregator_markup_percent: Math.round(aggregator_markup_percent * 100) / 100,
      expected_aggregator_guest_price,
      direct_price,
      direct_savings_for_guest,
      direct_owner_gain,
      pricing_channel:    'aggregator_adjusted',
      recommendation_type,
      reason,
      confidence:         Math.round(confidence * 100) / 100,
      source:             `cohort:${market.cohort_code}`
    }
  });
}

return recs;
