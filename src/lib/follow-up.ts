const FOLLOW_UP_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export function isDueForFollowUp(lastContact: Date): boolean {
  return Date.now() - lastContact.getTime() >= FOLLOW_UP_INTERVAL_MS;
}
