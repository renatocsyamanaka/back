function weekRangeOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 dom ... 6 sab
  const monday = new Date(d); monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return {
    start: new Date(monday.setHours(0,0,0,0)),
    end: new Date(sunday.setHours(23,59,59,999))
  }
}
module.exports = { weekRangeOf };
