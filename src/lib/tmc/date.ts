// Act dates follow the Almaty calendar, whatever timezone the server runs in.

const TZ = "Asia/Almaty";
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Today's date in Almaty as "YYYY-MM-DD". */
export function almatyToday(now: Date = new Date()): string {
  return ymd.format(now);
}

/** "2026-11-03" → "03 ноября 2026 г." */
export function formatActDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d} ${MONTHS_GEN[Number(m) - 1]} ${y} г.`;
}

export function isSameAlmatyDay(a: Date, b: Date): boolean {
  return ymd.format(a) === ymd.format(b);
}
