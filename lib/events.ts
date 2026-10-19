import { istDay } from "@/lib/usage/time";

/** What the pages receive. Dates stay "YYYY-MM-DD"; `expiresAt` is an ISO instant. */
export interface EventItem {
  id: string;
  title: string;
  organiser: string | null;
  type: "hackathon" | "contest" | "challenge" | "other";
  mode: "online" | "offline" | "hybrid" | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  datesKnown: boolean;
  expiresAt: string;
  link: string;
  summary: string | null;
  perks: string[];
  hiring: boolean;
  eligibility: string | null;
  note: string | null;
  imageUrl: string | null;
  createdAt: string;
}

/** The moderator list also shows hidden and recently expired events. */
export interface ModeratorEventItem extends EventItem {
  hidden: boolean;
  expired: boolean;
  submittedBy: string | null;
}

export const TYPE_LABELS: Record<EventItem["type"], string> = {
  hackathon: "Hackathon",
  contest: "Contest",
  challenge: "Challenge",
  other: "Event",
};

export const MODE_LABELS: Record<NonNullable<EventItem["mode"]>, string> = {
  online: "Online",
  offline: "In person",
  hybrid: "Hybrid",
};

export type Tone = "red" | "amber" | "neutral";

const DAY_MS = 86_400_000;

/** Whole IST days from today to the event's last day (0 = its last day is today). */
export function daysUntilClose(expiresAt: string | Date, now: Date = new Date()): number {
  const lastInstant = new Date(new Date(expiresAt).getTime() - 1);
  return Math.round((Date.parse(istDay(lastInstant)) - Date.parse(istDay(now))) / DAY_MS);
}

/** "Closes today" / "Closes in 5 days", red on the last two days and amber up to three days out. */
export function closingLabel(event: Pick<EventItem, "datesKnown" | "expiresAt">, now: Date = new Date()): { text: string; tone: Tone } {
  if (!event.datesKnown) return { text: "Dates not announced", tone: "neutral" };
  const days = daysUntilClose(event.expiresAt, now);
  if (days <= 0) return { text: "Closes today", tone: "red" };
  if (days === 1) return { text: "Closes tomorrow", tone: "red" };
  return { text: `Closes in ${days} days`, tone: days <= 3 ? "amber" : "neutral" };
}

/** "31 Oct 2026" from "2026-10-31". */
export function formatDay(day: string | null | undefined): string {
  if (!day) return "";
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "31 Oct 2026", or "30 Oct 2026 to 1 Nov 2026" when the event spans days. */
export function eventDates(e: Pick<EventItem, "startDate" | "endDate">): string {
  const start = formatDay(e.startDate);
  const end = formatDay(e.endDate);
  if (start && end && start !== end) return `${start} to ${end}`;
  return start || end;
}

/** Closest deadline first; events with no known date go last, newest first. */
export function sortEvents<T extends Pick<EventItem, "datesKnown" | "expiresAt" | "createdAt">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.datesKnown !== b.datesKnown) return a.datesKnown ? -1 : 1;
    if (a.datesKnown) return Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export interface EventFilters {
  type: EventItem["type"] | "all";
  mode: "all" | "online" | "in-person";
  hiringOnly: boolean;
}

export const NO_FILTERS: EventFilters = { type: "all", mode: "all", hiringOnly: false };

export function filterEvents<T extends Pick<EventItem, "type" | "mode" | "hiring">>(items: T[], f: EventFilters): T[] {
  return items.filter((e) => {
    if (f.type !== "all" && e.type !== f.type) return false;
    if (f.mode === "online" && e.mode !== "online") return false;
    if (f.mode === "in-person" && e.mode !== "offline" && e.mode !== "hybrid") return false;
    return !f.hiringOnly || e.hiring;
  });
}
