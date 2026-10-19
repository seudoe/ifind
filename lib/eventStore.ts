import { connectDB } from "@/lib/db";
import EventModel, { type IEvent } from "@/models/Event";
import type { EventItem, ModeratorEventItem } from "@/lib/events";

/** An event is shown to students until `expiresAt` passes, unless a moderator hid it. */
export function activeFilter(now: Date = new Date()) {
  return { hidden: { $ne: true }, expiresAt: { $gt: now } };
}

export function toEventItem(e: IEvent): EventItem {
  return {
    id: String(e._id),
    title: e.title,
    organiser: e.organiser ?? null,
    type: e.type ?? "other",
    mode: e.mode ?? null,
    location: e.location ?? null,
    startDate: e.startDate ?? null,
    endDate: e.endDate ?? null,
    registrationDeadline: e.registrationDeadline ?? null,
    datesKnown: e.datesKnown === true,
    expiresAt: new Date(e.expiresAt).toISOString(),
    link: e.link,
    summary: e.summary ?? null,
    perks: e.perks ?? [],
    hiring: e.hiring === true,
    eligibility: e.eligibility ?? null,
    note: e.note ?? null,
    imageUrl: e.imageUrl ?? null,
    createdAt: new Date(e.createdAt).toISOString(),
  };
}

export function toModeratorItem(e: IEvent, now: Date = new Date()): ModeratorEventItem {
  return { ...toEventItem(e), hidden: e.hidden === true, expired: new Date(e.expiresAt) <= now, submittedBy: e.submittedBy ?? null };
}

/** Active events, closest deadline first, events without a known date last. */
export async function listActiveEvents(now: Date = new Date(), limit = 200): Promise<EventItem[]> {
  await connectDB();
  const rows = await EventModel.find(activeFilter(now)).sort({ datesKnown: -1, expiresAt: 1, createdAt: -1 }).limit(limit).lean<IEvent[]>();
  return rows.map(toEventItem);
}
