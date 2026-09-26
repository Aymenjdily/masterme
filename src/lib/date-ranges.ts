export type TimeFilter = "all" | "this_week" | "last_week" | "this_month" | "last_month";

export const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as the first day of the week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getDateRange(filter: TimeFilter, now = new Date()): { start: Date; end: Date } | null {
  switch (filter) {
    case "this_week": {
      const start = startOfWeek(now);
      return { start, end: now };
    }
    case "last_week": {
      const thisWeekStart = startOfWeek(now);
      const start = new Date(thisWeekStart);
      start.setDate(start.getDate() - 7);
      const end = new Date(thisWeekStart);
      end.setMilliseconds(-1);
      return { start, end };
    }
    case "this_month": {
      const start = startOfMonth(now);
      return { start, end: now };
    }
    case "last_month": {
      const thisMonthStart = startOfMonth(now);
      const start = new Date(thisMonthStart);
      start.setMonth(start.getMonth() - 1);
      const end = new Date(thisMonthStart);
      end.setMilliseconds(-1);
      return { start, end };
    }
    case "all":
    default:
      return null;
  }
}

export function isWithinRange(date: Date, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}
