import mongoose from "mongoose";
import { z } from "zod";
import { isEligible } from "./eligibility";
import { eventMessage, type EventChange } from "./messages";
import { notifyStudents } from "./notify";
import { resolveStudentRecipients, sendToStudents, type Recipient } from "./outbound";
import type { Outcome } from "./student";
import CampusApplication from "@/models/CampusApplication";
import CampusEnrollment from "@/models/CampusEnrollment";
import CampusEvent, { type ICampusEvent } from "@/models/CampusEvent";
import CampusInternship from "@/models/CampusInternship";
import type { HydratedDocument } from "mongoose";
import {
    CAMPUS_ACTIVE_STATUSES, CAMPUS_EVENT_MODES, CAMPUS_EVENT_TYPES, isEventAudience,
    type CampusApplicationStatus, type CampusEligibility,
} from "@/types/campus";

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));
const no = (status: number, error: string, code?: string): Outcome<never> => ({ ok: false, status, error, code });

// ── validation ──────────────────────────────────────────────────────────────────────────────────────────────────────

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());
const date = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.date().nullable());

export const eventSchema = z.object({
    type: z.enum(CAMPUS_EVENT_TYPES).default("announcement"),
    title: z.string().trim().min(3, "Give the event a title").max(200),
    body: z.string().trim().max(10000).default(""),
    internshipId: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[a-f\d]{24}$/i).nullable().optional()),
    startsAt: date.default(null),
    endsAt: date.default(null),
    deadlineAt: date.default(null),
    mode: z.enum(CAMPUS_EVENT_MODES).default("online"),
    venue: opt(z.string().trim().max(300)),
    link: opt(z.string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) link")),
    audience: z.string().refine(isEventAudience, "Invalid audience").default("all_members"),
    notify: z.object({ email: z.boolean().default(true), sms: z.boolean().default(false) }).default({ email: true, sms: false }),
}).superRefine((v, ctx) => {
    if (!v.internshipId && (["eligible", "applicants", "shortlisted"].includes(v.audience) || v.audience.startsWith("round:"))) {
        ctx.addIssue({ code: "custom", path: ["audience"], message: "That audience needs an internship. Pick one or choose all students." });
    }
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end is before the start" });
});
export type EventInput = z.infer<typeof eventSchema>;

// ── audiences ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface StudentCtx {
    batch: number;
    /** Is the student eligible for the event's internship (null when the event has none). */
    eligible: boolean | null;
    /** The student's application for the event's internship, if any. */
    application: { status: CampusApplicationStatus; currentRound?: string | null; rounds: { name: string; result: string }[] } | null;
}

const SHORTLISTED: CampusApplicationStatus[] = ["shortlisted", "in_process", "offered", "accepted"];

/** The ONE definition of who an audience contains. Used for sending and for what a student sees in their feed. */
export function audienceIncludes(audience: string, s: StudentCtx): boolean {
    const active = !!s.application && CAMPUS_ACTIVE_STATUSES.includes(s.application.status);
    if (audience === "all_members") return true;
    if (audience === "eligible") return s.eligible === true;
    if (audience === "applicants") return active;
    if (audience === "shortlisted") return !!s.application && SHORTLISTED.includes(s.application.status);
    if (audience.startsWith("round:")) {
        const name = audience.slice(6);
        return active && (s.application!.currentRound === name || s.application!.rounds.some((r) => r.name === name && (r.result === "pending" || r.result === "cleared")));
    }
    if (audience.startsWith("batch:")) return s.batch === Number(audience.slice(6));
    return false;
}

/** Joined, messageable students of the campus who belong to the event's audience. */
export async function audienceRecipients(entityId: unknown, event: Pick<ICampusEvent, "audience" | "internshipId">): Promise<Recipient[]> {
    let apps = new Map<string, StudentCtx["application"]>();
    let rules: CampusEligibility | null = null;
    if (event.internshipId) {
        const [internship, rows] = await Promise.all([
            CampusInternship.findOne({ _id: event.internshipId, entityId: oid(entityId) }).select("eligibility").lean(),
            CampusApplication.find({ internshipId: event.internshipId, entityId: oid(entityId) }).select("studentId status currentRound rounds").lean(),
        ]);
        rules = internship?.eligibility ?? null;
        apps = new Map(rows.map((a) => [String(a.studentId), { status: a.status, currentRound: a.currentRound, rounds: a.rounds.map((r) => ({ name: r.name, result: r.result })) }]));
    }
    return resolveStudentRecipients(String(entityId), {
        filter: (e) => audienceIncludes(event.audience, { batch: e.batch, eligible: event.internshipId ? isEligible(e, rules).ok : null, application: apps.get(String(e.userId)) ?? null }),
    });
}

// ── create / update / cancel ────────────────────────────────────────────────────────────────────────────────────────

type EntityLite = { _id: mongoose.Types.ObjectId; name: string };
type EventDoc = HydratedDocument<ICampusEvent>;

/** In-app notice to everyone in the audience, plus email/SMS through the outbound channel (outbox + stubs). */
async function announce(entity: EntityLite, event: EventDoc, change: EventChange, changed?: string[]): Promise<number> {
    const recipients = await audienceRecipients(entity._id, event);
    const head = change === "created" ? "New" : change === "updated" ? "Updated" : "Cancelled";
    await notifyStudents(recipients.map((r) => r.id), {
        type: "campus_event", title: `${head}: ${event.title}`, body: change === "updated" && changed?.length ? `Changed: ${changed.join(", ")}` : undefined, path: "/campus",
    });
    if (event.notify.email || event.notify.sms) {
        await sendToStudents(
            recipients,
            (r) => eventMessage({ entityName: entity.name, title: event.title, change, startsAt: event.startsAt, venue: event.venue, changed, link: r.username ? `/user/${r.username}/campus` : "/" }),
            { email: event.notify.email, sms: event.notify.sms, kind: "event", refId: String(event._id), version: event.version, entityId: String(entity._id), defer: true },
        );
    }
    return recipients.length;
}

export async function createEvent(entity: EntityLite, input: EventInput, createdBy: mongoose.Types.ObjectId): Promise<Outcome<{ event: EventDoc; reach: number }>> {
    let internshipId: mongoose.Types.ObjectId | null = null;
    if (input.internshipId) {
        // The internship must be this campus's own
        const i = await CampusInternship.findOne({ _id: input.internshipId, entityId: entity._id }).select("_id").lean();
        if (!i) return no(404, "Internship not found", "not_found");
        internshipId = i._id;
    }
    const event = await CampusEvent.create({ ...input, internshipId, entityId: entity._id, createdBy, status: "scheduled", version: 1, notifiedAt: new Date() });
    const reach = await announce(entity, event, "created");
    return { ok: true, event, reach };
}

const fmtDate = (d?: Date | null) => (d ? d.getTime() : null);
const LABELS = { startsAt: "time", endsAt: "end time", deadlineAt: "deadline", venue: "venue", link: "link", mode: "mode" } as const;

/** Fields whose change is worth telling students about. Typos in the body or title are not. */
export function materialChanges(before: Pick<ICampusEvent, keyof typeof LABELS>, after: Pick<EventInput, keyof typeof LABELS>): string[] {
    const out: string[] = [];
    for (const k of ["startsAt", "endsAt", "deadlineAt"] as const) if (fmtDate(before[k]) !== fmtDate(after[k])) out.push(LABELS[k]);
    for (const k of ["venue", "link", "mode"] as const) if ((before[k] ?? null) !== (after[k] ?? null)) out.push(LABELS[k]);
    return out;
}

export async function updateEvent(entity: EntityLite, eventId: string, input: EventInput): Promise<Outcome<{ event: EventDoc; notified: boolean }>> {
    if (!mongoose.isValidObjectId(eventId)) return no(404, "Event not found", "not_found");
    const event = await CampusEvent.findOne({ _id: eventId, entityId: entity._id });
    if (!event) return no(404, "Event not found", "not_found");
    if (event.status === "cancelled") return no(409, "A cancelled event can't be edited.", "cancelled");
    // The internship an event belongs to never changes; the audience must stay valid for it
    if (!event.internshipId && (["eligible", "applicants", "shortlisted"].includes(input.audience) || input.audience.startsWith("round:"))) return no(400, "That audience needs an internship.", "bad_audience");

    const changed = materialChanges(event, input);
    const material = changed.length > 0 && !!event.notifiedAt;
    event.set({
        type: input.type, title: input.title, body: input.body, startsAt: input.startsAt, endsAt: input.endsAt, deadlineAt: input.deadlineAt,
        mode: input.mode, venue: input.venue ?? null, link: input.link ?? null, audience: input.audience, notify: input.notify,
        ...(material ? { version: event.version + 1 } : {}),
    });
    await event.save();
    if (material) await announce(entity, event, "updated", changed);
    return { ok: true, event, notified: material };
}

/** Cancelling tells the audience once. The event stays in the feed, struck through. */
export async function cancelEvent(entity: EntityLite, eventId: string): Promise<Outcome<{ event: EventDoc }>> {
    if (!mongoose.isValidObjectId(eventId)) return no(404, "Event not found", "not_found");
    const claimed = await CampusEvent.findOneAndUpdate({ _id: eventId, entityId: entity._id, status: { $ne: "cancelled" } }, { $set: { status: "cancelled" }, $inc: { version: 1 } }, { returnDocument: "after" });
    if (!claimed) return (await CampusEvent.exists({ _id: eventId, entityId: entity._id })) ? no(409, "Already cancelled.", "cancelled") : no(404, "Event not found", "not_found");
    if (claimed.notifiedAt) await announce(entity, claimed, "cancelled");
    return { ok: true, event: claimed };
}

/** Only an event nobody was told about can be deleted. Anything announced is cancelled instead. */
export async function deleteEvent(entityId: unknown, eventId: string): Promise<Outcome> {
    if (!mongoose.isValidObjectId(eventId)) return no(404, "Event not found", "not_found");
    const res = await CampusEvent.deleteOne({ _id: eventId, entityId: oid(entityId), notifiedAt: null });
    if (res.deletedCount === 1) return { ok: true };
    return (await CampusEvent.exists({ _id: eventId, entityId: oid(entityId) })) ? no(409, "Students were already told about this event. Cancel it instead.", "announced") : no(404, "Event not found", "not_found");
}

// ── what a student sees ─────────────────────────────────────────────────────────────────────────────────────────────

export type FeedTag = "applied" | "open" | "muted" | null;

export interface FeedItem {
    _id: string;
    type: string;
    title: string;
    body: string;
    startsAt: string | null;
    endsAt: string | null;
    deadlineAt: string | null;
    mode: string;
    venue: string | null;
    link: string | null;
    status: string;
    at: string;
    internship: { id: string; company: string; designation: string } | null;
    /** applied = "You applied", open = "Open to you", muted = not eligible, null = campus-wide. */
    tag: FeedTag;
}

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null);

/** Loads one student's view of the campus events: the audience rules and the apply/eligibility colouring applied per event. */
export async function studentEventContext(userId: string) {
    const enrollment = await CampusEnrollment.findOne({ userId: oid(userId) });
    if (!enrollment?.entityId) return null;
    const [apps, internships] = await Promise.all([
        CampusApplication.find({ studentId: enrollment.userId, entityId: enrollment.entityId }).select("internshipId status currentRound rounds").lean(),
        CampusInternship.find({ entityId: enrollment.entityId }).select("company.name designation eligibility").lean(),
    ]);
    const appBy = new Map(apps.map((a) => [String(a.internshipId), a]));
    const intBy = new Map(internships.map((i) => [String(i._id), i]));
    const ctxFor = (event: Pick<ICampusEvent, "internshipId">): { ctx: StudentCtx; internship: (typeof internships)[number] | null } => {
        const i = event.internshipId ? intBy.get(String(event.internshipId)) ?? null : null;
        const a = event.internshipId ? appBy.get(String(event.internshipId)) : undefined;
        return {
            internship: i,
            ctx: {
                batch: enrollment.batch,
                eligible: i ? isEligible(enrollment, i.eligibility).ok : null,
                application: a ? { status: a.status, currentRound: a.currentRound, rounds: a.rounds.map((r) => ({ name: r.name, result: r.result })) } : null,
            },
        };
    };
    return { enrollment, ctxFor };
}

/** Can this student see this event (used by the feed and the calendar download)? */
export async function eventForStudent(userId: string, eventId: string): Promise<EventDoc | null> {
    const c = await studentEventContext(userId);
    if (!c || !mongoose.isValidObjectId(eventId)) return null;
    const event = await CampusEvent.findOne({ _id: eventId, entityId: c.enrollment.entityId });
    if (!event) return null;
    return audienceIncludes(event.audience, c.ctxFor(event).ctx) ? event : null;
}

export async function homeFeed(userId: string): Promise<FeedItem[] | null> {
    const c = await studentEventContext(userId);
    if (!c) return null;
    const since = new Date(Date.now() - 30 * 86_400_000);
    const events = await CampusEvent.find({ entityId: c.enrollment.entityId, $or: [{ startsAt: { $gte: since } }, { deadlineAt: { $gte: since } }, { startsAt: null, deadlineAt: null, createdAt: { $gte: since } }] }).sort({ startsAt: 1 }).limit(300);
    const items: FeedItem[] = [];
    for (const e of events) {
        const { ctx, internship } = c.ctxFor(e);
        if (!audienceIncludes(e.audience, ctx)) continue;
        const applied = !!ctx.application && ctx.application.status !== "withdrawn";
        items.push({
            _id: String(e._id), type: e.type, title: e.title, body: e.body, startsAt: iso(e.startsAt), endsAt: iso(e.endsAt), deadlineAt: iso(e.deadlineAt),
            mode: e.mode, venue: e.venue ?? null, link: e.link ?? null, status: e.status, at: iso(e.startsAt ?? e.deadlineAt ?? e.createdAt)!,
            internship: internship ? { id: String(internship._id), company: internship.company.name, designation: internship.designation } : null,
            tag: !internship ? null : applied ? "applied" : ctx.eligible ? "open" : "muted",
        });
    }
    return items.sort((a, b) => a.at.localeCompare(b.at));
}
