const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateParam(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

export function parseDateParam(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function todayDateParam(): string {
  return new Date().toISOString().slice(0, 10);
}
