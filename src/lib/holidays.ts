function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getNthMonday(year: number, month: number, n: number): Date {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (true) {
    if (d.getDay() === 1) {
      count++;
      if (count === n) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
}

function dk(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getJamaicanHolidays(year: number): Map<string, string> {
  const h = new Map<string, string>();
  const easter = getEaster(year);

  h.set(dk(new Date(year, 0, 1)), "New Year's Day");
  h.set(dk(shiftDays(easter, -46)), "Ash Wednesday");
  h.set(dk(shiftDays(easter, -2)), "Good Friday");
  h.set(dk(shiftDays(easter, 1)), "Easter Monday");
  h.set(dk(new Date(year, 4, 23)), "Labour Day");
  h.set(dk(new Date(year, 7, 1)), "Emancipation Day");
  h.set(dk(new Date(year, 7, 6)), "Independence Day");
  h.set(dk(getNthMonday(year, 10, 3)), "National Heroes Day");
  h.set(dk(new Date(year, 11, 25)), "Christmas Day");
  h.set(dk(new Date(year, 11, 26)), "Boxing Day");

  return h;
}

export function holidayName(dateStr: string): string | null {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return getJamaicanHolidays(year).get(dateStr) ?? null;
}
