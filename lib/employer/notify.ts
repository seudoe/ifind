import type mongoose from "mongoose";
import { emailConfigured, sendEmail } from "@/lib/email/brevo";
import { DEFAULT_PRIORITY, type NotificationPriority } from "@/lib/email/priority";
import { notificationEmail } from "@/lib/email/templates";
import Company from "@/models/Company";
import Employer from "@/models/Employer";
import Moderator from "@/models/Moderator";
import { CompanyNotification, notificationModel, type ICompanyNotification } from "@/models/Notification";
import User from "@/models/User";
import type { NotificationType, RecipientType } from "@/types/employer";

type Id = string | mongoose.Types.ObjectId;

/**
 * Every notification is stored in the inbox. A `critical` one (see lib/email/priority.ts for the table) is also emailed
 * through Brevo; a `normal` one waits for the next visit. Pass `priority` to override the default of the type.
 */

interface NotifyInput {
    recipientType: RecipientType;
    recipientIds: Id[];
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    companyId?: Id;
    priority?: NotificationPriority;
}

/** Email addresses for a set of people. Banned accounts are skipped. */
async function addressesOf(kind: RecipientType, ids: Id[]): Promise<{ email: string; name?: string }[]> {
    const filter = { _id: { $in: ids }, isBanned: { $ne: true } };
    const model = kind === "student" ? User : kind === "employer" ? Employer : Moderator;
    const rows = await (model as typeof User).find(filter).select("email name").lean();
    return rows.filter((r) => r.email).map((r) => ({ email: r.email as string, name: r.name as string | undefined }));
}

/** Runs after the response when inside a request, otherwise inline (scripts, tests). Never throws. */
async function defer(fn: () => Promise<void>) {
    const run = () => fn().catch((err) => console.error("[notify:email]", err));
    try {
        const { after } = await import("next/server");
        after(run);
    } catch {
        await run();
    }
}

async function emailPersonal(kind: RecipientType, ids: Id[], input: { type: NotificationType; title: string; body?: string; link?: string }, docIds: Id[]) {
    if (!emailConfigured()) return;
    const to = await addressesOf(kind, ids);
    const { html, text } = notificationEmail({ title: input.title, body: input.body, link: input.link });
    const ok = await sendEmail({ to, subject: input.title, html, text, tags: ["notification", input.type] });
    if (ok) await notificationModel(kind).updateMany({ _id: { $in: docIds } }, { $set: { emailedAt: new Date() } });
}

/** One notification per recipient. Never throws: a failed notification must not fail the action that triggered it. */
export async function notify({ recipientIds, priority, ...rest }: NotifyInput): Promise<void> {
    if (!recipientIds.length) return;
    const level = priority ?? DEFAULT_PRIORITY[rest.type] ?? "normal";
    try {
        const unique = [...new Set(recipientIds.map(String))];
        const docs = await notificationModel(rest.recipientType).insertMany(unique.map((id) => ({ ...rest, recipientId: id, priority: level })));
        if (level === "critical") {
            await defer(() => emailPersonal(rest.recipientType, unique, rest, docs.map((d) => d._id)));
        }
    } catch (err) {
        console.error("[notify]", err);
    }
}

interface CompanyNotifyInput {
    companyId: Id;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    actor?: ICompanyNotification["actor"];
    priority?: NotificationPriority;
}

/**
 * One notification for the whole company (notifications.company), visible to every member. Use this for anything the
 * team should see; use notify() with recipientType "employer" for things meant for one person only.
 * A critical one is emailed to every current member.
 */
export async function notifyCompany({ priority, ...input }: CompanyNotifyInput): Promise<void> {
    const level = priority ?? DEFAULT_PRIORITY[input.type] ?? "normal";
    try {
        const doc = await CompanyNotification.create({ ...input, priority: level });
        if (level !== "critical") return;
        await defer(async () => {
            if (!emailConfigured()) return;
            const company = await Company.findById(input.companyId).select("name members.employerId").lean();
            if (!company) return;
            const to = await addressesOf("employer", company.members.map((m) => m.employerId));
            const { html, text } = notificationEmail({ title: input.title, body: input.body, link: input.link, contextLine: `${company.name} · team update` });
            if (await sendEmail({ to, subject: `${company.name}: ${input.title}`, html, text, tags: ["notification", "company", input.type] })) {
                await CompanyNotification.updateOne({ _id: doc._id }, { $set: { emailedAt: new Date() } });
            }
        });
    } catch (err) {
        console.error("[notifyCompany]", err);
    }
}

/** Every verified, active moderator: the audience for review-queue events. */
export async function moderatorIds(): Promise<mongoose.Types.ObjectId[]> {
    const mods = await Moderator.find({ isVerified: true, isBanned: { $ne: true } }).select("_id").lean();
    return mods.map((m) => m._id as mongoose.Types.ObjectId);
}
