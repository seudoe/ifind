import { newInternshipMessage, reminderMessage } from "./messages";
import { notifyStudents } from "./notify";
import { audienceRecipients } from "./events";
import { resolveStudentRecipients, sendToStudents } from "./outbound";
import CampusApplication from "@/models/CampusApplication";
import CampusEvent from "@/models/CampusEvent";
import CampusInternship, { type ICampusInternship } from "@/models/CampusInternship";
import type mongoose from "mongoose";

type EntityLite = { _id: mongoose.Types.ObjectId; name: string };

/**
 * Tells the eligible, joined students of the campus about a newly published internship: in-app, plus email/SMS through
 * the outbound channel. Runs ONCE per internship: `emailedAt` is claimed atomically, so a re-publish, a duplicate click
 * or two coordinators at once never announce it twice. Returns the number of students told.
 */
export async function announceInternship(entity: EntityLite, internship: Pick<ICampusInternship, "_id" | "eligibility" | "deadlineDate"> & { company: { name: string }; designation: string }): Promise<number> {
    const claimed = await CampusInternship.updateOne({ _id: internship._id, entityId: entity._id, emailedAt: null }, { $set: { emailedAt: new Date() } });
    if (claimed.modifiedCount !== 1) return 0;
    const recipients = await resolveStudentRecipients(String(entity._id), { eligibleFor: internship.eligibility });
    await notifyStudents(recipients.map((r) => r.id), {
        type: "campus_internship", title: `New internship: ${internship.company.name}`, body: internship.designation, path: "/campus/internships",
    });
    await sendToStudents(
        recipients,
        (r) => newInternshipMessage({ entityName: entity.name, company: internship.company.name, designation: internship.designation, deadline: internship.deadlineDate, link: r.username ? `/user/${r.username}/campus/internships` : "/" }),
        { email: true, kind: "internship", refId: String(internship._id), version: 1, entityId: String(entity._id), defer: true },
    );
    return recipients.length;
}

export interface ReminderCounts { events: number; deadlines: number; recipients: number }

/**
 * 24-hour reminders, safe to run as often as you like (every few minutes to hourly): each event version and each
 * internship deadline is claimed atomically before sending, so nobody is reminded twice.
 *  - events starting (or due) within the next 24 hours -> the event's audience;
 *  - open internships closing within 24 hours -> eligible joined students who have not applied yet.
 */
export async function sendReminders(now = new Date()): Promise<ReminderCounts> {
    const soon = new Date(now.getTime() + 24 * 3_600_000);
    const out: ReminderCounts = { events: 0, deadlines: 0, recipients: 0 };

    const events = await CampusEvent.find({
        status: "scheduled", notifiedAt: { $ne: null },
        $or: [{ startsAt: { $gt: now, $lte: soon } }, { startsAt: null, deadlineAt: { $gt: now, $lte: soon } }],
    }).limit(200);
    for (const e of events) {
        const claim = await CampusEvent.updateOne({ _id: e._id, status: "scheduled", remindedVersion: { $lt: e.version } }, { $set: { remindedVersion: e.version } });
        if (claim.modifiedCount !== 1) continue;
        const when = e.startsAt ?? e.deadlineAt;
        const recipients = await audienceRecipients(e.entityId, e);
        await notifyStudents(recipients.map((r) => r.id), { type: "campus_event", title: `Tomorrow: ${e.title}`, path: "/campus" });
        await sendToStudents(recipients, (r) => reminderMessage({ title: e.title, startsAt: when, link: r.username ? `/user/${r.username}/campus` : "/" }),
            { email: e.notify.email, sms: e.notify.sms, kind: "event-reminder", refId: String(e._id), version: e.version, entityId: String(e.entityId), defer: false });
        out.events++;
        out.recipients += recipients.length;
    }

    const closing = await CampusInternship.find({ status: "open", remindedAt: null, deadlineDate: { $gt: now, $lte: soon } }).limit(200);
    for (const i of closing) {
        const claim = await CampusInternship.updateOne({ _id: i._id, status: "open", remindedAt: null }, { $set: { remindedAt: now } });
        if (claim.modifiedCount !== 1) continue;
        const applied = new Set((await CampusApplication.find({ internshipId: i._id, status: { $ne: "withdrawn" } }).select("studentId").lean()).map((a) => String(a.studentId)));
        const recipients = (await resolveStudentRecipients(String(i.entityId), { eligibleFor: i.eligibility })).filter((r) => !applied.has(r.id));
        await notifyStudents(recipients.map((r) => r.id), { type: "campus_internship", title: `Closing soon: ${i.company.name}`, body: `${i.designation} · apply within 24 hours`, path: "/campus/internships" });
        await sendToStudents(recipients, (r) => reminderMessage({ title: `Apply to ${i.company.name} (${i.designation})`, startsAt: i.deadlineDate, link: r.username ? `/user/${r.username}/campus/internships` : "/" }),
            { email: true, kind: "deadline-reminder", refId: String(i._id), version: 1, entityId: String(i.entityId), defer: false });
        out.deadlines++;
        out.recipients += recipients.length;
    }
    return out;
}
