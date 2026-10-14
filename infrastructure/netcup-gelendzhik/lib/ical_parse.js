// Разбор iCal-выгрузки площадки в занятость [check_in, check_out) по датам (Europe/Moscow).
// Чистая функция: используется в n8n Code-узле WF16 (вставляется как есть) и в тестах (node ical_parse.test.js).
// Возвращает {ok, error?, events:[{uid, check_in:'YYYY-MM-DD', check_out:'YYYY-MM-DD', summary}], skipped}.
function parseIcal(text) {
  const MSK_OFFSET_MIN = 180; // Europe/Moscow: UTC+3 без перехода на летнее время с 2014
  if (typeof text !== 'string' || !/BEGIN:VCALENDAR/i.test(text) || !/END:VCALENDAR/i.test(text)) {
    return { ok: false, error: 'not a VCALENDAR', events: [], skipped: 0 };
  }
  const lines = text.replace(/\r\n|\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

  function toDate(prop) {
    if (!prop) return null;
    const v = prop.value.trim();
    let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return ymd(m[1], m[2], m[3]);
    m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return null;
    if (m[7] === 'Z') { // UTC → Москва, затем отбрасываем время
      const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + MSK_OFFSET_MIN * 60000;
      return new Date(t).toISOString().slice(0, 10);
    }
    return ymd(m[1], m[2], m[3]); // TZID=… или «плавающее» время — местная дата как есть
  }
  function parseProp(line) {
    const i = line.indexOf(':'); if (i < 0) return null;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const parts = head.split(';');
    const params = {};
    for (const p of parts.slice(1)) { const [k, ...r] = p.split('='); params[k.toUpperCase()] = r.join('='); }
    return { name: parts[0].toUpperCase(), params, value };
  }
  function durationDays(v) {
    const m = (v || '').match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
    if (!m) return null;
    return (+(m[1] || 0)) * 7 + (+(m[2] || 0)) + ((+(m[3] || 0)) >= 24 ? Math.floor(+m[3] / 24) : 0);
  }
  const unescape = (s) => (s || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

  const events = []; let skipped = 0; let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT$/i.test(line)) {
      if (cur) {
        const status = (cur.STATUS && cur.STATUS.value.trim().toUpperCase()) || '';
        let ci = toDate(cur.DTSTART), co = toDate(cur.DTEND);
        if (ci && !co) {
          const dd = cur.DURATION ? durationDays(cur.DURATION.value) : null;
          co = addDays(ci, dd && dd > 0 ? dd : 1);
        }
        if (status === 'CANCELLED' || !ci || !co) { skipped++; }
        else {
          if (co <= ci) co = addDays(ci, 1); // однодневное событие с временем внутри дня
          const summary = unescape(cur.SUMMARY && cur.SUMMARY.value);
          const uid = (cur.UID && cur.UID.value.trim()) || `nouid-${ci}-${co}-${summary}`.slice(0, 200);
          events.push({ uid, check_in: ci, check_out: co, summary });
        }
      }
      cur = null; continue;
    }
    if (cur) { const p = parseProp(line); if (p && !(p.name in cur)) cur[p.name] = p; }
  }
  return { ok: true, events, skipped };
}
if (typeof module !== 'undefined') module.exports = { parseIcal };
