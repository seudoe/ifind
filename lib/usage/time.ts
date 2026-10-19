/** Usage days are IST calendar days (UTC+5:30, no DST), so the daily limit resets at midnight IST. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the IST day containing `date`. */
export function istDay(date: Date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next IST midnight after `date`, as a real instant. */
export function nextIstMidnight(date: Date = new Date()): Date {
  const shifted = date.getTime() + IST_OFFSET_MS;
  const dayStart = Math.floor(shifted / 86_400_000) * 86_400_000;
  return new Date(dayStart + 86_400_000 - IST_OFFSET_MS);
}
