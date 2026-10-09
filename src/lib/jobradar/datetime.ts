/**
 * Quota "days" are calendar days in the config's timezone. Shared by the
 * collector (writing usage) and the overview API (reading usage) so both
 * agree on day boundaries regardless of server timezone.
 */

/** "Today" in the given timezone as YYYY-MM-DD. */
export function zonedDayKey(date: Date, timezone: string): string {
  // en-CA renders YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC midnight of a YYYY-MM-DD day — the value stored in Date columns. */
export function utcMidnight(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The stored “day” representing today in the timezone. */
export function utcMidnightToday(timezone: string): Date {
  return utcMidnight(zonedDayKey(new Date(), timezone));
}
