function monthRange(yyyymm) {
  // yyyymm = '2025-08'  (aceita também Date; cai pro mês atual)
  let d;
  if (!yyyymm) d = new Date();
  else d = new Date(`${yyyymm}-01T00:00:00Z`);

  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}
module.exports = { monthRange };