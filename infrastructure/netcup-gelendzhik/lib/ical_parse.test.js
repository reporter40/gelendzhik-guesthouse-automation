const assert = require('node:assert/strict');
const { parseIcal } = require('./ical_parse.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS:', name); };
const cal = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
const ev = (lines) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT\r\n`;

t('не календарь → ok=false (HTML-страница ошибки)', () => assert.equal(parseIcal('<html>502</html>').ok, false));
t('пустой календарь → ok, 0 событий', () => { const r = parseIcal(cal('')); assert.equal(r.ok, true); assert.equal(r.events.length, 0); });
t('VALUE=DATE: DTEND = день выезда', () => {
  const r = parseIcal(cal(ev(['UID:a1', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261104', 'SUMMARY:Бронь'])));
  assert.deepEqual(r.events[0], { uid: 'a1', check_in: '2026-11-01', check_out: '2026-11-04', summary: 'Бронь' });
});
t('UTC …Z → Москва до отбрасывания времени (22:00Z = следующий день МСК)', () => {
  const r = parseIcal(cal(ev(['UID:z', 'DTSTART:20261031T220000Z', 'DTEND:20261103T090000Z'])));
  assert.equal(r.events[0].check_in, '2026-11-01'); assert.equal(r.events[0].check_out, '2026-11-03');
});
t('TZID=Europe/Moscow: местная дата', () => {
  const r = parseIcal(cal(ev(['UID:tz', 'DTSTART;TZID=Europe/Moscow:20261101T140000', 'DTEND;TZID=Europe/Moscow:20261103T120000'])));
  assert.equal(r.events[0].check_in, '2026-11-01'); assert.equal(r.events[0].check_out, '2026-11-03');
});
t('перенос длинной строки (folding)', () => {
  const r = parseIcal(cal('BEGIN:VEVENT\r\nUID:long-\r\n uid-123\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261102\r\nEND:VEVENT\r\n'));
  assert.equal(r.events[0].uid, 'long-uid-123');
});
t('без DTEND, VALUE=DATE → одна ночь', () => {
  const r = parseIcal(cal(ev(['UID:x', 'DTSTART;VALUE=DATE:20261101']))); assert.equal(r.events[0].check_out, '2026-11-02');
});
t('DURATION:P3D', () => {
  const r = parseIcal(cal(ev(['UID:d', 'DTSTART;VALUE=DATE:20261101', 'DURATION:P3D']))); assert.equal(r.events[0].check_out, '2026-11-04');
});
t('STATUS:CANCELLED пропускается', () => {
  const r = parseIcal(cal(ev(['UID:c', 'STATUS:CANCELLED', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261103'])));
  assert.equal(r.events.length, 0); assert.equal(r.skipped, 1);
});
t('без UID → стабильный синтетический UID', () => {
  const a = parseIcal(cal(ev(['DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261103', 'SUMMARY:x'])));
  const b = parseIcal(cal(ev(['DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261103', 'SUMMARY:x'])));
  assert.equal(a.events[0].uid, b.events[0].uid); assert.match(a.events[0].uid, /^nouid-2026-11-01-2026-11-03/);
});
t('событие внутри одного дня (время) → минимум одна ночь', () => {
  const r = parseIcal(cal(ev(['UID:s', 'DTSTART:20261101T100000', 'DTEND:20261101T180000'])));
  assert.equal(r.events[0].check_in, '2026-11-01'); assert.equal(r.events[0].check_out, '2026-11-02');
});
t('экранирование в SUMMARY и LF-переводы строк', () => {
  const r = parseIcal('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:e\nDTSTART;VALUE=DATE:20261101\nDTEND;VALUE=DATE:20261102\nSUMMARY:Иванов\\, 2 гостя\nEND:VEVENT\nEND:VCALENDAR\n');
  assert.equal(r.events[0].summary, 'Иванов, 2 гостя');
});
t('реальный формат RC (DATE-TIME без Z)', () => {
  const r = parseIcal(cal(ev(['UID:rc-1', 'DTSTART:20260930T000000', 'DTEND:20270401T000000', 'SUMMARY:RC(193854598)'])));
  assert.equal(r.events[0].check_in, '2026-09-30'); assert.equal(r.events[0].check_out, '2027-04-01');
});
t('наша собственная выгрузка разбирается (петли отсекает SQL по домену UID)', () => {
  const r = parseIcal(cal(ev(['UID:15@avail.aquatoring', 'DTSTAMP:20261014T120000Z', 'DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261108', 'SUMMARY:Занято'])));
  assert.equal(r.events[0].uid, '15@avail.aquatoring');
});
console.log(`OK ${n} tests`);
