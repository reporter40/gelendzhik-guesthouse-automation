const prep = $('Prep Export RC').first().json;
if (prep.prep_err) {
  return [{ json: { ok: false, error: prep.prep_err } }];
}

const row = $input.first().json;
if (!row || !row.rec_id) {
  return [{ json: { ok: false, error: 'recommendation not found or status is not approved' } }];
}

const markupPct = row.aggregator_markup_percent != null ? Number(row.aggregator_markup_percent) : 18;

const recommended_guest_price = Math.round(Number(row.recommended_guest_price ?? row.recommended_price));
const rcFallback = Math.round(recommended_guest_price / (1 + markupPct / 100));

const rc_net_price = row.rc_net_price != null ? Math.round(Number(row.rc_net_price)) : rcFallback;

const expected_aggregator_guest_price = row.expected_aggregator_guest_price != null
  ? Math.round(Number(row.expected_aggregator_guest_price))
  : Math.round(rc_net_price * (1 + markupPct / 100));

const direct_price = row.direct_price != null
  ? Math.round(Number(row.direct_price))
  : Math.round(recommended_guest_price * 0.95);

const direct_savings_for_guest = row.direct_savings_for_guest != null
  ? Math.round(Number(row.direct_savings_for_guest))
  : (expected_aggregator_guest_price - direct_price);

const direct_owner_gain = row.direct_owner_gain != null
  ? Math.round(Number(row.direct_owner_gain))
  : (direct_price - rc_net_price);

const dateFrom = new Date(row.date_from);
const dateTo   = new Date(row.date_to);

const nightlyRc = rc_net_price;
const nights = row.nights || Math.round((dateTo - dateFrom) / 86400000);

const pricesObj = {};
for (let i = 0; i < nights; i++) {
  const d = new Date(dateFrom);
  d.setDate(d.getDate() + i);
  const key = d.toISOString().slice(0, 10);
  pricesObj[key] = nightlyRc;
}

const dfStr = row.date_from;
const dtStr = row.date_to;
const lastNight = new Date(dateTo);
lastNight.setDate(lastNight.getDate() - 1);
const lastNightStr = lastNight.toISOString().slice(0, 10);
const aptName = row.apartment_name || '';
const lotId   = row.lot_id || '';

const lines = [
  `Открой RealtyCalendar → Управление ценами → ${aptName} (lot_id: ${lotId})`,
  `В RealtyCalendar поставьте ${nightlyRc} \u20bd/\u043d\u043e\u0447\u044c (net) \u043d\u0430 \u043f\u0435\u0440\u0438\u043e\u0434 ${dfStr} \u2014 ${lastNightStr} \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u0435\u043b\u044c\u043d\u043e.`,
  `\u041d\u0430 \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u043e\u0440\u0435 \u0433\u043e\u0441\u0442\u044c \u0443\u0432\u0438\u0434\u0438\u0442 \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u043e ${recommended_guest_price} \u20bd \u0441 \u0443\u0447\u0451\u0442\u043e\u043c \u043d\u0430\u0446\u0435\u043d\u043a\u0438 ${Math.round(markupPct)}%.`,
  `\u041e\u0436\u0438\u0434\u0430\u0435\u043c\u0430\u044f \u0446\u0435\u043d\u0430 \u0434\u043b\u044f \u0433\u043e\u0441\u0442\u044f \u043f\u043e\u0441\u043b\u0435 \u043a\u0430\u043d\u0430\u043b\u0430: ~${expected_aggregator_guest_price} \u20bd.`,
  `\u041f\u0440\u044f\u043c\u0430\u044f \u0446\u0435\u043d\u0430 (\u0431\u0435\u0437 \u043f\u043e\u0441\u0440\u0435\u0434\u043d\u0438\u043a\u0430): ~${direct_price} \u20bd; \u0433\u043e\u0441\u0442\u044e \u0432\u044b\u0433\u043e\u0434\u043d\u0435\u0435 \u043d\u0430 ~${direct_savings_for_guest} \u20bd, \u0432\u043b\u0430\u0434\u0435\u043b\u044c\u0446\u0443 \u043b\u0443\u0447\u0448\u0435 \u043d\u0430 ~${direct_owner_gain} \u20bd.`,
  `\u041d\u043e\u0447\u0435\u0439: ${nights}`,
  `\u0421\u043a\u043e\u043f\u0438\u0440\u0443\u0439 JSON (prices_obj) \u0434\u043b\u044f batch-\u0432\u0432\u043e\u0434\u0430 (\u044d\u0442\u043e net \u0446\u0435\u043d\u044b).`,
  `\u041f\u043e\u0441\u043b\u0435 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043d\u0430\u0436\u043c\u0438 "Mark as manually applied" \u0432 Admin \u043f\u0430\u043d\u0435\u043b\u0438.`,
  `Recommendation ID: ${row.rec_id}`,
];

return [{
  json: {
    ok: true,
    action: 'pricing_recommendation_export_rc',
    recommendation_id: row.rec_id,
    apartment_id: row.apartment_id,
    apartment_name: aptName,
    lot_id: lotId,
    date_from: dfStr,
    date_to: dtStr,
    nights,
    recommended_price: recommended_guest_price,
    recommended_guest_price,
    rc_net_price,
    aggregator_markup_percent: Math.round(markupPct * 100) / 100,
    expected_aggregator_guest_price,
    direct_price,
    direct_savings_for_guest,
    direct_owner_gain,
    prices_obj: pricesObj,
    manual_instruction: lines.join('\\n'),
    instruction_lines: lines,
  }
}];
