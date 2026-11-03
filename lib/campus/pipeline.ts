import mongoose from "mongoose";
import { applicationStatusMessage, bannedMessage, removedMessage, unbannedMessage, type Built } from "./messages";
import { notifyStudents } from "./notify";
import { resolveStudentRecipients, sendToStudents } from "./outbound";
import type { Outcome } from "./student";
import CampusApplication from "@/models/CampusApplication";
import CampusBlacklist from "@/models/CampusBlacklist";
import CampusEnrollment from "@/models/CampusEnrollment";
import CampusEntity from "@/models/CampusEntity";
import CampusInternship from "@/models/CampusInternship";
import { CAMPUS_ACTIVE_STATUSES, CAMPUS_ROUND_RESULTS, canStaffTransition, type CampusApplicationStatus } from "@/types/campus";

export interface Actor {
    id: mongoose.Types.ObjectId;
    name: string;
}
type EntityLite = { _id: mongoose.Types.ObjectId; name: string; policy?: { acceptWindowHours?: number | null } | null };

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));
const no = (status: number, error: string, code?: string): Outcome<never> => ({ ok: false, status, error, code });
const isDup = (e: unknown) => typeof e === "object" && !!e && "code" in e && e.code === 11000;

/** Tells one student, in-app and through the outbound channel (email stub). Never throws. */
async function tellStudent(
    entityId: unknown, studentId: unknown, inApp: { type: "campus_application_status" | "campus_removed" | "campus_banned"; title: string; body?: string; path: string },
    build: (link: string) => Built, kind: string, refId: string, version: string,
) {
    await notifyStudents([String(studentId)], inApp);
    await sendToStudents(
        await resolveStudentRecipients(String(entityId), { studentIds: [String(studentId)], includeBlocked: true }),
        (r) => build(r.username ? `/user/${r.username}${inApp.path}` : "/"),
        { email: true, kind, refId, version, entityId: String(entityId), defer: true },
    );
}

async function context(entityId: unknown, applicationId: string) {
    if (!mongoose.isValidObjectId(applicationId)) return null;
    const app = await CampusApplication.findOne({ _id: applicationId, entityId: oid(entityId) });
    if (!app) return null;
    const internship = await CampusInternship.findOne({ _id: app.internshipId, entityId: oid(entityId) }).select("company.name designation").lean();
    return { app, company: internship?.company.name ?? "", designation: internship?.designation ?? "" };
}

/**
 * Staff moves an application along (shortlist, in process, offer, reject). One conditional update: a concurrent change by
 * another coordinator gives 409 instead of being overwritten. Removing and reinstating have their own functions.
 */
export async function changeCampusStatus(entity: EntityLite, applicationId: string, to: CampusApplicationStatus, actor: Actor, note?: string | null): Promise<Outcome<{ status: CampusApplicationStatus }>> {
    const c = await context(entity._id, applicationId);
    if (!c) return no(404, "Application not found", "not_found");
    const from = c.app.status;
    if (to === "removed" || to === "applied") return no(400, "Use remove or reinstate for that.", "use_remove");
    if (!canStaffTransition(from, to)) return no(409, `Can't move an application from ${from.replace("_", " ")} to ${to.replace("_", " ")}.`, "bad_transition");

    const set: Record<string, unknown> = { status: to };
    if (to === "offered") {
        const hours = entity.policy?.acceptWindowHours;
        set.offer = { acceptBy: hours ? new Date(Date.now() + hours * 3_600_000) : null, respondedAt: null };
    }
    const res = await CampusApplication.updateOne(
        { _id: c.app._id, entityId: oid(entity._id), status: from },
        { $set: set, $push: { statusHistory: { status: to, changedBy: actor.id, changedAt: new Date(), note: note ?? null } } },
    );
    if (res.modifiedCount !== 1) return no(409, "Someone else just changed this application. Reload and try again.", "conflict");

    const label = to.replace("_", " ");
    await tellStudent(entity._id, c.app.studentId,
        { type: "campus_application_status", title: `${c.company}: you are now ${label}`, body: c.designation, path: `/campus/applied/${String(c.app._id)}` },
        (link) => applicationStatusMessage({ company: c.company, designation: c.designation, status: to, link }), "app-status", String(c.app._id), `${to}:${c.app.statusHistory.length}`);
    return { ok: true, status: to };
}

/** Moves many applications; each one is judged on its own transition, failures are reported, not fatal. */
export async function bulkChangeStatus(entity: EntityLite, ids: string[], to: CampusApplicationStatus, actor: Actor) {
    const updated: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of ids) {
        const r = await changeCampusStatus(entity, id, to, actor);
        if (r.ok) updated.push(id);
        else failed.push({ id, error: r.error });
    }
    return { updated, failed };
}

/**
 * Staff removes a student from ONE internship. This is not a ban: the student can apply elsewhere, and only this
 * internship stays closed to them until staff reinstate them.
 */
export async function removeFromInternship(entity: EntityLite, applicationId: string, actor: Actor, reason?: string | null): Promise<Outcome<{ status: CampusApplicationStatus }>> {
    const c = await context(entity._id, applicationId);
    if (!c) return no(404, "Application not found", "not_found");
    const from = c.app.status;
    if (!canStaffTransition(from, "removed")) return no(409, `A ${from.replace("_", " ")} application can't be removed.`, "bad_transition");
    const why = reason?.trim().slice(0, 500) || null;
    const res = await CampusApplication.updateOne(
        { _id: c.app._id, entityId: oid(entity._id), status: from },
        { $set: { status: "removed", removal: { by: actor.id, at: new Date(), reason: why } }, $push: { statusHistory: { status: "removed", changedBy: actor.id, changedAt: new Date(), note: why } } },
    );
    if (res.modifiedCount !== 1) return no(409, "Someone else just changed this application. Reload and try again.", "conflict");
    await tellStudent(entity._id, c.app.studentId,
        { type: "campus_removed", title: `You were removed from ${c.company}`, body: why ?? c.designation, path: `/campus/applied/${String(c.app._id)}` },
        (link) => removedMessage({ company: c.company, designation: c.designation, reason: why, link }), "removed", String(c.app._id), String(c.app.statusHistory.length));
    return { ok: true, status: "removed" };
}

/** Lets a removed student back into the internship (their application returns to "applied"). */
export async function reinstate(entity: EntityLite, applicationId: string, actor: Actor): Promise<Outcome<{ status: CampusApplicationStatus }>> {
    const c = await context(entity._id, applicationId);
    if (!c) return no(404, "Application not found", "not_found");
    if (c.app.status !== "removed") return no(409, "Only a removed application can be reinstated.", "bad_transition");
    const res = await CampusApplication.updateOne(
        { _id: c.app._id, entityId: oid(entity._id), status: "removed" },
        { $set: { status: "applied", removal: null }, $push: { statusHistory: { status: "applied", changedBy: actor.id, changedAt: new Date(), note: "Reinstated by staff" } } },
    );
    if (res.modifiedCount !== 1) return no(409, "Someone else just changed this application. Reload and try again.", "conflict");
    await tellStudent(entity._id, c.app.studentId,
        { type: "campus_application_status", title: `You were reinstated for ${c.company}`, body: c.designation, path: `/campus/applied/${String(c.app._id)}` },
        (link) => applicationStatusMessage({ company: c.company, designation: c.designation, status: "applied", link }), "app-status", String(c.app._id), `reinstated:${c.app.statusHistory.length}`);
    return { ok: true, status: "applied" };
}

/** Result of one selection round (staff-visible and shown to the student on their application). */
export async function setRoundResult(entity: EntityLite, applicationId: string, round: { name: string; result: (typeof CAMPUS_ROUND_RESULTS)[number]; note?: string | null }): Promise<Outcome> {
    const c = await context(entity._id, applicationId);
    if (!c) return no(404, "Application not found", "not_found");
    if (!CAMPUS_ACTIVE_STATUSES.includes(c.app.status)) return no(409, "This application is closed.", "bad_transition");
    const name = round.name.trim().slice(0, 80);
    if (!name || !CAMPUS_ROUND_RESULTS.includes(round.result)) return no(400, "A round name and a valid result are required", "bad_request");
    const entry = { name, result: round.result, at: new Date(), note: round.note?.trim().slice(0, 500) || null };
    // replace the entry for this round if there is one, otherwise add it
    const upd = await CampusApplication.updateOne({ _id: c.app._id, entityId: oid(entity._id), "rounds.name": name }, { $set: { "rounds.$": entry, currentRound: name } });
    if (upd.matchedCount === 0) await CampusApplication.updateOne({ _id: c.app._id, entityId: oid(entity._id) }, { $push: { rounds: entry }, $set: { currentRound: name } });
    return { ok: true };
}

/** Staff-only notes and rating. Never returned to students or exported. */
export async function addNote(entityId: unknown, applicationId: string, authorId: mongoose.Types.ObjectId, text: string): Promise<Outcome> {
    const t = text.trim().slice(0, 2000);
    if (!t) return no(400, "Write a note first", "bad_request");
    const res = await CampusApplication.updateOne({ _id: applicationId, entityId: oid(entityId) }, { $push: { notes: { authorId, text: t, createdAt: new Date() } } });
    return res.matchedCount === 1 ? { ok: true } : no(404, "Application not found", "not_found");
}

export async function setRating(entityId: unknown, applicationId: string, rating: number | null): Promise<Outcome> {
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return no(400, "Rating is 1 to 5", "bad_request");
    const res = await CampusApplication.updateOne({ _id: applicationId, entityId: oid(entityId) }, { $set: { rating } });
    return res.matchedCount === 1 ? { ok: true } : no(404, "Application not found", "not_found");
}

// ── blacklist ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Bars a student from FUTURE internships of this campus. Scoped to the campus; lifted with unban. Optionally also
 * removes them from their open applications here. The student is told the reason.
 */
export async function banStudent(entity: EntityLite, studentId: string, actor: Actor, reason: string, removeOpen: boolean): Promise<Outcome<{ removed: number }>> {
    const why = reason.trim().slice(0, 500);
    if (why.length < 3) return no(400, "Give a reason (at least 3 characters). The student will see it.", "reason_required");
    if (!mongoose.isValidObjectId(studentId)) return no(404, "Student not found", "not_found");
    // Only students who belong to, or applied to, this campus can be barred by its staff
    const belongs = (await CampusEnrollment.exists({ userId: studentId, entityId: entity._id })) || (await CampusApplication.exists({ studentId, entityId: entity._id }));
    if (!belongs) return no(404, "Student not found", "not_found");
    try {
        await CampusBlacklist.create({ entityId: entity._id, studentId: oid(studentId), reason: why, bannedBy: actor.id });
    } catch (err) {
        if (isDup(err)) return no(409, "This student is already barred.", "already_banned");
        throw err;
    }
    let removed = 0;
    if (removeOpen) {
        const open = await CampusApplication.find({ entityId: entity._id, studentId, status: { $in: CAMPUS_ACTIVE_STATUSES } }).select("_id").lean();
        for (const a of open) if ((await removeFromInternship(entity, String(a._id), actor, `Barred: ${why}`)).ok) removed++;
    }
    await tellStudent(entity._id, studentId,
        { type: "campus_banned", title: `You can't apply to ${entity.name} internships`, body: why, path: "/campus/details" },
        (link) => bannedMessage({ entityName: entity.name, reason: why, link }), "banned", String(studentId), String(Date.now()));
    return { ok: true, removed };
}

export async function unbanStudent(entity: EntityLite, studentId: string, actor: Actor): Promise<Outcome> {
    if (!mongoose.isValidObjectId(studentId)) return no(404, "Student not found", "not_found");
    const res = await CampusBlacklist.updateOne({ entityId: entity._id, studentId: oid(studentId), active: true }, { $set: { active: false, liftedBy: actor.id, liftedAt: new Date() } });
    if (res.modifiedCount !== 1) return no(404, "This student is not on the blacklist.", "not_found");
    await tellStudent(entity._id, studentId,
        { type: "campus_application_status", title: `You can apply to ${entity.name} internships again`, path: "/campus/internships" },
        (link) => unbannedMessage({ entityName: entity.name, link }), "unbanned", String(studentId), String(Date.now()));
    return { ok: true };
}

export async function listBlacklist(entityId: unknown) {
    const rows = await CampusBlacklist.aggregate([
        { $match: { entityId: oid(entityId), active: true } },
        { $sort: { bannedAt: -1 } },
        { $limit: 500 },
        { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "u", pipeline: [{ $project: { name: 1, email: 1 } }] } },
        { $lookup: { from: "colleges.students", localField: "studentId", foreignField: "userId", as: "e", pipeline: [{ $project: { collegeUid: 1, batch: 1 } }] } },
        { $lookup: { from: "employers", localField: "bannedBy", foreignField: "_id", as: "b", pipeline: [{ $project: { name: 1 } }] } },
    ]);
    return rows.map((r) => ({
        studentId: String(r.studentId), name: r.u?.[0]?.name ?? "Unknown", email: r.u?.[0]?.email ?? "", collegeUid: r.e?.[0]?.collegeUid ?? null,
        reason: r.reason as string, bannedBy: r.b?.[0]?.name ?? "Unknown", bannedAt: new Date(r.bannedAt).toISOString(),
    }));
}

/** Staff detaches a student from the campus: their open applications are removed and they return to "no campus". */
export async function removeStudentFromCampus(entity: EntityLite, studentId: string, actor: Actor, reason?: string | null): Promise<Outcome<{ removed: number }>> {
    if (!mongoose.isValidObjectId(studentId)) return no(404, "Student not found", "not_found");
    const enrollment = await CampusEnrollment.findOne({ userId: studentId, entityId: entity._id });
    if (!enrollment) return no(404, "Student not found", "not_found");
    const open = await CampusApplication.find({ entityId: entity._id, studentId, status: { $in: CAMPUS_ACTIVE_STATUSES } }).select("_id").lean();
    let removed = 0;
    for (const a of open) if ((await removeFromInternship(entity, String(a._id), actor, reason ?? "Removed from the campus")).ok) removed++;
    const res = await CampusEnrollment.updateOne({ _id: enrollment._id, entityId: entity._id }, { $set: { entityId: null, joinedAt: null } });
    if (res.modifiedCount === 1) await CampusEntity.updateOne({ _id: entity._id, studentCount: { $gt: 0 } }, { $inc: { studentCount: -1 } });
    await notifyStudents([studentId], {
        type: "campus_removed", title: `You were removed from ${entity.name}`, body: reason?.trim().slice(0, 500) || "You can join another campus from College details.", path: "/campus/details",
    });
    return { ok: true, removed };
}
