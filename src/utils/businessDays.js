function isBusinessDay(d) {
  const day = d.getDay(); // 0 dom, 6 sáb
  return day !== 0 && day !== 6;
}

// adiciona N dias úteis a partir de start (incluindo o próprio start como dia 1)
function addBusinessDaysInclusive(startDate, businessDays) {
  if (!startDate || !businessDays || businessDays <= 0) return null;

  const d = new Date(startDate);
  d.setHours(12, 0, 0, 0); // evita bug de timezone/DST

  let counted = 0;
  while (counted < businessDays) {
    if (isBusinessDay(d)) counted++;
    if (counted >= businessDays) break;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

module.exports = { addBusinessDaysInclusive };
