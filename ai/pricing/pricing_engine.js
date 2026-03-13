// Gelendzhik Dynamic Pricing Engine — n8n Code node
// Вход: $json.apartment_id, $json.base_price, $json.target_date
// Опционально: $json.nights, $json.occupancy_rate

const basePrice = $json.base_price;
const targetDate = new Date($json.target_date);
const month = targetDate.getMonth() + 1;
const day = targetDate.getDate();
const dow = targetDate.getDay();
const today = new Date();
const daysUntil = Math.round((targetDate - today) / 86400000);

// 1. Сезон
let seasonMult = 1.0, seasonName = 'межсезон';
if (month === 8) { seasonMult = 2.2; seasonName = 'пик-август'; }
else if (month === 7) { seasonMult = 2.0; seasonName = 'пик-июль'; }
else if (month === 9) { seasonMult = 1.3; seasonName = 'бархат'; }
else if (month === 10) { seasonMult = 1.1; seasonName = 'поздний-бархат'; }
else if ([5,6].includes(month)) { seasonMult = 1.1; seasonName = 'предсезон'; }
else { seasonMult = 0.95; seasonName = 'межсезон'; }

// 2. Праздники РФ
const holidays = ['01-01','01-02','01-03','01-04','01-05','01-06','01-07','01-08', '02-23','03-08','05-01','05-09','06-12','11-04','12-31'];
const mmdd = String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0');
const isHoliday = holidays.includes(mmdd);
if (isHoliday) { seasonMult = Math.max(seasonMult, 1.6); seasonName = 'праздник'; }

// 3-6. Модификаторы
const isWeekend = [0,5,6].includes(dow);
const weekendMult = isWeekend ? 1.20 : 1.0;
const urgencyMult = (daysUntil >= 0 && daysUntil < 3) ? 0.85 : 1.0;
const longStayMult = ($json.nights || 1) >= 7 ? 0.90 : 1.0;
const demandMult = ($json.occupancy_rate || 0) > 0.80 ? 1.10 : 1.0;

// 7. Финальная цена
let finalPrice = basePrice * seasonMult * weekendMult * urgencyMult * longStayMult * demandMult;
finalPrice = Math.round(finalPrice / 50) * 50;
finalPrice = Math.max(finalPrice, basePrice * 0.80);
finalPrice = Math.min(finalPrice, basePrice * 3.0);

return [{ json: {
  apartment_id: $json.apartment_id,
  date: $json.target_date,
  base_price: basePrice,
  final_price: finalPrice,
  multiplier: +(finalPrice / basePrice).toFixed(2),
  season: seasonName,
  is_weekend: isWeekend,
  is_holiday: isHoliday,
  breakdown: `С×${seasonMult} В×${weekendMult} У×${urgencyMult} Д×${longStayMult} З×${demandMult}`
}}];
