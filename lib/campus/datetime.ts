const pad = (n: number) => String(n).padStart(2, "0");

/** ISO string -> value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (empty stays empty). */
export const toIsoInput = (v: string): string => (v ? new Date(v).toISOString() : "");

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Feed grouping by calendar day in the viewer's zone. */
export function dayBucket(iso: string, now = new Date()): "earlier" | "today" | "tomorrow" | "upcoming" {
    const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY);
    return diff < 0 ? "earlier" : diff === 0 ? "today" : diff === 1 ? "tomorrow" : "upcoming";
}

/** "in 3 days", "in 5 hours", "passed". */
export function countdown(iso: string, now = new Date()): string {
    const ms = new Date(iso).getTime() - now.getTime();
    if (ms <= 0) return "passed";
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return `in ${Math.max(1, Math.floor(ms / 60_000))} min`;
    if (h < 48) return `in ${h} hour${h === 1 ? "" : "s"}`;
    return `in ${Math.floor(h / 24)} days`;
}
