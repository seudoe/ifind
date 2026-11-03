import mongoose from "mongoose";
import { log } from "@/lib/logger";
import { dispatchEmail } from "@/lib/messaging/email";
import { claimOutbox, finishOutbox } from "@/lib/messaging/outbox";
import { dispatchSms } from "@/lib/messaging/sms";
import type { DispatchResult, EmailMessage, SmsMessage } from "@/lib/messaging/types";
import CampusBlacklist from "@/models/CampusBlacklist";
import CampusEnrollment from "@/models/CampusEnrollment";
import User from "@/models/User";
import type { CampusEligibility } from "@/types/campus";
import { isEligible } from "./eligibility";
import type { Built } from "./messages";

/**
 * The ONLY place campus code fans messages out. It resolves who may receive, then calls dispatchEmail / dispatchSms
 * once per person. Never call lib/email/brevo.ts or a provider from campus code.
 */
export interface Recipient {
    id: string;
    email?: string | null;
    name?: string | null;
    username?: string | null;
    phone?: string | null;
    emailUpdates: boolean;
    smsUpdates: boolean;
}

export interface Transport {
    email: (m: EmailMessage) => Promise<DispatchResult>;
    sms: (m: SmsMessage) => Promise<DispatchResult>;
}
const defaultTransport: Transport = { email: dispatchEmail, sms: dispatchSms };

export interface SendOptions {
    /** Channel switches of the event/internship. SMS additionally needs the student's smsUpdates + phone. */
    email: boolean;
    sms?: boolean;
    /** Message kind, e.g. "internship", "event". Part of the idempotency key and the tags. */
    kind: string;
    /** Id of the internship/event/application the message is about. */
    refId: string;
    /** Bump when the same thing is re-announced (event update) so it is not de-duplicated away. */
    version?: number | string;
    /** Run after the response when inside a request (never blocks, never throws). Default false: inline. */
    defer?: boolean;
    /** Campus the message belongs to; stored on the outbox row. */
    entityId?: string;
    /** Test seam. */
    transport?: Transport;
}

export interface SendCounts {
    recipients: number;
    emailed: number;
    texted: number;
    skipped: number;
    failed: number;
}

const CHUNK = 20;

/** A stub that throws or rejects is counted as failed, never propagated. */
async function settle(fn: () => Promise<DispatchResult>): Promise<PromiseSettledResult<DispatchResult>> {
    try {
        return { status: "fulfilled", value: await fn() };
    } catch (reason) {
        return { status: "rejected", reason };
    }
}

export const idempotencyKey = (kind: string, refId: string, recipientId: string, version: number | string = 1) => `${kind}:${refId}:${recipientId}:${version}`;

async function run<T extends { id: string }>(
    audience: "student" | "employer",
    recipients: T[],
    build: (r: T) => Built,
    opts: SendOptions,
    smsAllowed: (r: T) => boolean,
    emailAllowed: (r: T) => boolean,
    address: (r: T) => { email?: string | null; name?: string | null; phone?: string | null },
): Promise<SendCounts> {
    const t = opts.transport ?? defaultTransport;
    const counts: SendCounts = { recipients: recipients.length, emailed: 0, texted: 0, skipped: 0, failed: 0 };
    // Every message is recorded in messaging.outbox before it is sent, and the outcome (sent / failed + times) after.
    // A failed or not-yet-implemented send stays retryable for a later job. The same key is never claimed twice.
    const send = async (channel: "email" | "sms", row: { to: string; toName?: string | null; subject?: string; text: string; link?: string; recipientId: string; key: string; tags: string[] }, call: () => Promise<DispatchResult>) => {
        const owned = await claimOutbox({
            channel, kind: opts.kind, refId: opts.refId, recipientType: audience, recipientId: row.recipientId, to: row.to, toName: row.toName,
            subject: row.subject, text: row.text, link: row.link, tags: row.tags, idempotencyKey: row.key,
            entityId: opts.entityId ? (new mongoose.Types.ObjectId(opts.entityId)) : undefined,
        });
        if (!owned) { counts.skipped++; return; }
        const res = await settle(call);
        await finishOutbox(channel, row.key, res.status === "fulfilled" ? { result: res.value } : { thrown: res.reason });
        if (res.status === "rejected" || !res.value) counts.failed++;
        else if (res.value.ok) counts[channel === "email" ? "emailed" : "texted"]++;
        else if (res.value.skipped) counts.skipped++;
        else counts.failed++;
    };
    for (let i = 0; i < recipients.length; i += CHUNK) {
        await Promise.all(
            recipients.slice(i, i + CHUNK).map(async (r) => {
                const a = address(r);
                const m = build(r);
                const key = idempotencyKey(opts.kind, opts.refId, r.id, opts.version);
                const tags = ["campus", opts.kind];
                if (opts.email) {
                    if (emailAllowed(r) && a.email) {
                        await send("email", { to: a.email, toName: a.name, subject: m.subject, text: m.text, link: m.link, recipientId: r.id, key, tags },
                            () => t.email({ to: a.email!, toName: a.name ?? undefined, subject: m.subject, text: m.text, link: m.link, tags, idempotencyKey: key }));
                    } else counts.skipped++;
                }
                if (opts.sms) {
                    if (smsAllowed(r) && a.phone) {
                        const text = `${m.text}${m.link ? ` ${m.link}` : ""}`;
                        await send("sms", { to: a.phone, text, recipientId: r.id, key, tags }, () => t.sms({ to: a.phone!, text, tags, idempotencyKey: key }));
                    } else counts.skipped++;
                }
            }),
        );
    }
    return counts;
}

async function maybeDefer(job: () => Promise<SendCounts>, defer?: boolean): Promise<SendCounts> {
    const empty: SendCounts = { recipients: 0, emailed: 0, texted: 0, skipped: 0, failed: 0 };
    const safe = () => job().catch((err) => { log.error("campus/outbound", "send failed", { error: err }); return empty; });
    if (!defer) return safe();
    try {
        const { after } = await import("next/server");
        after(safe);
        return empty;
    } catch {
        return safe();
    }
}

/** Students: honours emailUpdates / smsUpdates. Callers pass recipients already filtered by resolveStudentRecipients(). */
export function sendToStudents(recipients: Recipient[], build: (r: Recipient) => Built, opts: SendOptions): Promise<SendCounts> {
    return maybeDefer(
        () => run("student", recipients, build, opts, (r) => r.smsUpdates, (r) => r.emailUpdates, (r) => r),
        opts.defer,
    );
}

export interface StaffRecipient {
    id: string;
    email?: string | null;
    name?: string | null;
}

/** Staff: email only. Account/security style messages are not opt-out. */
export function sendToStaff(recipients: StaffRecipient[], build: (r: StaffRecipient) => Built, opts: Omit<SendOptions, "sms">): Promise<SendCounts> {
    return maybeDefer(
        () => run("employer", recipients, build, { ...opts, sms: false }, () => false, () => true, (r) => r),
        opts.defer,
    );
}

export interface ResolveOptions {
    /** Restrict to these student ids (e.g. applicants of one internship). */
    studentIds?: string[];
    /** Only students passing this eligibility rule set. */
    eligibleFor?: CampusEligibility;
    /** Only this batch. */
    batch?: number;
}

/**
 * Joined students of an entity who may be messaged: account exists and is not banned, not on the entity's active
 * blacklist, has an address. Opt-outs are applied at send time (they differ per channel).
 */
export async function resolveStudentRecipients(entityId: string, opts: ResolveOptions = {}): Promise<Recipient[]> {
    const filter: Record<string, unknown> = { entityId };
    if (opts.studentIds) filter.userId = { $in: opts.studentIds };
    if (opts.batch != null) filter.batch = opts.batch;
    let enrollments = await CampusEnrollment.find(filter).lean();
    if (opts.eligibleFor) enrollments = enrollments.filter((e) => isEligible(e, opts.eligibleFor).ok);
    if (!enrollments.length) return [];
    const ids = enrollments.map((e) => e.userId);
    const [users, banned] = await Promise.all([
        User.find({ _id: { $in: ids }, isBanned: { $ne: true }, "deleteDetails.deleted": { $ne: true } }).select("email name phone username").lean(),
        CampusBlacklist.find({ entityId, studentId: { $in: ids }, active: true }).select("studentId").lean(),
    ]);
    const blocked = new Set(banned.map((b) => String(b.studentId)));
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const out: Recipient[] = [];
    for (const e of enrollments) {
        const u = byId.get(String(e.userId));
        if (!u || blocked.has(String(e.userId))) continue;
        out.push({
            id: String(e.userId),
            email: u.email || null,
            name: u.name || null,
            username: u.username || null,
            phone: e.phone || u.phone || null,
            emailUpdates: e.emailUpdates !== false,
            smsUpdates: e.smsUpdates === true,
        });
    }
    return out;
}
