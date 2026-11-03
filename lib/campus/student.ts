import mongoose from "mongoose";
import { z } from "zod";
import { ERR, JOIN_CERTAINTY } from "./copy";
import { normalizeJoinCode } from "./joinCode";
import { notifyCollege } from "./notify";
import CampusApplication from "@/models/CampusApplication";
import CampusEnrollment, { type ICampusEnrollment } from "@/models/CampusEnrollment";
import CampusEntity, { type ICampusEntity } from "@/models/CampusEntity";
import CampusEntityReport from "@/models/CampusEntityReport";
import CampusInternship from "@/models/CampusInternship";
import Employer from "@/models/Employer";
import User from "@/models/User";
import { CAMPUS_ACTIVE_STATUSES, CAMPUS_REPORT_REASONS, type CampusReportReason } from "@/types/campus";
import College from "@/models/College";
import type { HydratedDocument } from "mongoose";

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));
const live = { isActive: true, "deleteDetails.deleted": { $ne: true } } as const;
const isDup = (err: unknown) => typeof err === "object" && !!err && "code" in err && err.code === 11000;

// ── enrollment ──────────────────────────────────────────────────────────────────────────────────────────────────────

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());
const thisYear = new Date().getFullYear();

export const enrollmentSchema = z.object({
    collegeId: z.string().regex(/^[a-f\d]{24}$/i, "Pick your college"),
    course: z.string().trim().min(1, "Course is required").max(120),
    department: z.string().trim().min(1, "Department is required").max(120),
    collegeUid: z.string().trim().min(1, "Your college ID is required").max(60),
    batch: z.coerce.number().int().min(thisYear - 1).max(thisYear + 8),
    currentYear: opt(z.coerce.number().int().min(1).max(8)),
    cgpa: opt(z.coerce.number().min(0).max(100)),
    activeBacklogs: opt(z.coerce.number().int().min(0).max(100)),
    phone: opt(z.string().trim().max(20).regex(/^[+\d][\d\s-]{6,18}$/, "Enter a valid phone number")),
    collegeEmail: opt(z.string().trim().toLowerCase().email("Enter a valid email")),
    section: opt(z.string().trim().max(20)),
});
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

export const getEnrollment = (userId: string) => CampusEnrollment.findOne({ userId: oid(userId) });

export type SaveResult = { ok: true; enrollment: HydratedDocument<ICampusEnrollment> } | { ok: false; status: number; error: string; code?: string };

/** Creates or updates the student's college details. Works with no campus; changing college while joined needs leaving first. */
export async function saveEnrollment(userId: string, input: EnrollmentInput): Promise<SaveResult> {
    if (!(await College.exists({ _id: input.collegeId }))) return { ok: false, status: 400, error: "That college was not found" };
    const existing = await getEnrollment(userId);
    if (existing?.entityId && String(existing.collegeId) !== input.collegeId) {
        return { ok: false, status: 409, code: "college_change_blocked", error: "Leave your current campus before changing your college." };
    }
    const data = {
        collegeId: oid(input.collegeId), course: input.course, department: input.department, collegeUid: input.collegeUid, batch: input.batch,
        currentYear: input.currentYear ?? null, cgpa: input.cgpa ?? null, activeBacklogs: input.activeBacklogs ?? null,
        phone: input.phone ?? null, collegeEmail: input.collegeEmail ?? null, section: input.section ?? null,
    };
    try {
        const enrollment = await CampusEnrollment.findOneAndUpdate(
            { userId: oid(userId) },
            { $set: data, $setOnInsert: { userId: oid(userId), entityId: null, emailUpdates: true, smsUpdates: false } },
            { upsert: true, returnDocument: "after", runValidators: true },
        );
        return { ok: true, enrollment: enrollment! };
    } catch (err) {
        if (isDup(err)) return saveEnrollment(userId, input); // two tabs created it at once: second call updates
        throw err;
    }
}

// ── blockers ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Blocker {
    applicationId: string;
    internshipId: string;
    company: string;
    designation: string;
    status: string;
}

/** Active (non-final) applications of this student in this entity: they block leaving and switching. */
export async function activeApplications(userId: string, entityId: unknown): Promise<Blocker[]> {
    const apps = await CampusApplication.find({ studentId: oid(userId), entityId: oid(entityId), status: { $in: CAMPUS_ACTIVE_STATUSES } }).select("internshipId status").lean();
    if (!apps.length) return [];
    const interns = await CampusInternship.find({ _id: { $in: apps.map((a) => a.internshipId) } }).select("company.name designation").lean();
    const byId = new Map(interns.map((i) => [String(i._id), i]));
    return apps.map((a) => {
        const i = byId.get(String(a.internshipId));
        return { applicationId: String(a._id), internshipId: String(a.internshipId), company: i?.company.name ?? "", designation: i?.designation ?? "", status: a.status };
    });
}

// ── campuses of my college ──────────────────────────────────────────────────────────────────────────────────────────

export interface CampusSummary {
    _id: string;
    name: string;
    logo: string | null;
    description: string;
    creatorName: string;
    staffCount: number;
    studentCount: number;
    createdAt: string;
    reportCount: number;
    myReport: CampusReportReason | null;
    joined: boolean;
    /** What this campus calls the student ID, and its course/department options (for the details form). */
    uidLabel: string;
    courses: { name: string; departments: string[] }[];
}

/** Student-facing view of an entity. Never includes the join code or staff emails. */
export async function summarize(entities: ICampusEntity[], userId: string, joinedId: unknown): Promise<CampusSummary[]> {
    if (!entities.length) return [];
    const [creators, reports] = await Promise.all([
        Employer.find({ _id: { $in: entities.map((e) => e.createdBy) } }).select("name").lean(),
        CampusEntityReport.find({ studentId: oid(userId), entityId: { $in: entities.map((e) => e._id) } }).select("entityId reason").lean(),
    ]);
    const creator = new Map(creators.map((c) => [String(c._id), c.name]));
    const mine = new Map(reports.map((r) => [String(r.entityId), r.reason]));
    return entities.map((e) => ({
        _id: String(e._id), name: e.name, logo: e.logo ?? null, description: e.description ?? "",
        creatorName: creator.get(String(e.createdBy)) ?? "Unknown", staffCount: e.members.length, studentCount: e.studentCount ?? 0,
        createdAt: e.createdAt.toISOString(), reportCount: e.reportCount ?? 0, myReport: mine.get(String(e._id)) ?? null, joined: String(e._id) === String(joinedId ?? ""),
        uidLabel: e.uidLabel, courses: e.courses.map((c) => ({ name: c.name, departments: [...c.departments] })),
    }));
}

/** Listed, healthy campuses of the student's college, plus the one they joined (even if code-only). */
export async function campusesFor(enrollment: ICampusEnrollment, userId: string) {
    const listed = await CampusEntity.find({ collegeId: enrollment.collegeId, ...live, "restriction.status": "none", listing: "listed" }).sort({ createdAt: 1 }).limit(50);
    let current: ICampusEntity | null = null;
    if (enrollment.entityId) current = await CampusEntity.findOne({ _id: enrollment.entityId, ...live });
    const all = current && !listed.some((e) => e._id.equals(current!._id)) ? [...listed, current] : listed;
    const items = await summarize(all, userId, enrollment.entityId);
    return { items, current: items.find((i) => i.joined) ?? null };
}

// ── join / leave ────────────────────────────────────────────────────────────────────────────────────────────────────

export type Outcome<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string; code?: string; extra?: Record<string, unknown> };
const no = (status: number, error: string, code?: string, extra?: Record<string, unknown>): Outcome<never> => ({ ok: false, status, error, code, extra });

export type JoinTarget = { entityId: string } | { code: string };

/** Resolves a target to a campus the student may join. Same college only; healthy only; code_only entities only via code. */
export async function resolveTarget(enrollment: ICampusEnrollment, target: JoinTarget): Promise<Outcome<{ entity: HydratedDocument<ICampusEntity> }>> {
    let entity: HydratedDocument<ICampusEntity> | null;
    if ("code" in target) {
        const code = normalizeJoinCode(target.code);
        if (!code) return no(404, ERR.invalidCode, "invalid_code");
        entity = await CampusEntity.findOne({ joinCode: code, ...live });
        if (!entity) return no(404, ERR.invalidCode, "invalid_code");
    } else {
        if (!mongoose.isValidObjectId(target.entityId)) return no(404, "Campus not found", "not_found");
        entity = await CampusEntity.findOne({ _id: target.entityId, ...live, listing: "listed" });
        // the campus they are already in may be code-only
        if (!entity && enrollment.entityId && String(enrollment.entityId) === target.entityId) entity = await CampusEntity.findOne({ _id: target.entityId, ...live });
        if (!entity) return no(404, "Campus not found", "not_found");
    }
    if (!entity.collegeId.equals(enrollment.collegeId)) {
        return no(403, "This campus belongs to a different college. Check your college in College details.", "wrong_college");
    }
    if (entity.restriction?.status && entity.restriction.status !== "none") {
        return no(403, "This campus can't accept new students right now.", "restricted");
    }
    return { ok: true, entity };
}

export interface JoinInput {
    target: JoinTarget;
    /** The student ticked the "I am certain" box (JOIN_CERTAINTY). Always required. */
    confirm: boolean;
    /** The student accepted the red switch warning. Required when already in another campus. */
    confirmSwitch: boolean;
}

/**
 * Join, or switch from another campus (6.4). All rules are enforced here:
 *  - details must exist; the campus must be the student's college and healthy;
 *  - `confirm` is always required (JOIN_CERTAINTY);
 *  - already in another campus: 409 already_joined (with blockers) unless `confirmSwitch`;
 *  - any active application in the current campus: 409 has_active_applications (re-checked after the move, and undone if
 *    one appeared meanwhile);
 *  - a blacklist entry on the new campus does not stop joining (it blocks applying).
 */
export async function joinCampus(userId: string, input: JoinInput): Promise<Outcome<{ entityId: string; switched: boolean }>> {
    const enrollment = await getEnrollment(userId);
    if (!enrollment) return no(400, "Fill in your college details first.", "no_enrollment");
    const resolved = await resolveTarget(enrollment, input.target);
    if (!resolved.ok) return resolved;
    const { entity } = resolved;

    const prev = enrollment.entityId;
    if (prev && prev.equals(entity._id)) return { ok: true, entityId: String(entity._id), switched: false }; // idempotent
    if (!input.confirm) return no(400, JOIN_CERTAINTY, "confirm_required");

    if (prev) {
        const blockers = await blockersFor(userId, prev);
        if (!input.confirmSwitch) return no(409, ERR.alreadyJoined, "already_joined", { current: String(prev), blockers });
        if (blockers.length) return no(409, ERR.hasActiveApplications, "has_active_applications", { applications: blockers });
    }

    const now = new Date();
    const moved = await CampusEnrollment.updateOne({ _id: enrollment._id, entityId: prev ?? null }, { $set: { entityId: entity._id, joinedAt: now } });
    if (moved.modifiedCount !== 1) return no(409, "Your campus just changed. Reload and try again.", "conflict");

    if (prev) {
        // Re-check inside the operation: an application created between the first check and the move undoes the move
        const late = await blockersFor(userId, prev);
        if (late.length) {
            await CampusEnrollment.updateOne({ _id: enrollment._id, entityId: entity._id }, { $set: { entityId: prev, joinedAt: enrollment.joinedAt ?? null } });
            return no(409, ERR.hasActiveApplications, "has_active_applications", { applications: late });
        }
        await CampusEntity.updateOne({ _id: prev, studentCount: { $gt: 0 } }, { $inc: { studentCount: -1 } });
        await tellStaffLeft(userId, prev, `${entity.name}`);
    }
    await CampusEntity.updateOne({ _id: entity._id }, { $inc: { studentCount: 1 } });
    return { ok: true, entityId: String(entity._id), switched: !!prev };
}

/** Active applications that block leaving; none when the campus is gone or closed (its applications were withdrawn). */
async function blockersFor(userId: string, entityId: unknown): Promise<Blocker[]> {
    const entity = await CampusEntity.findById(entityId).select("isActive deleteDetails restriction").lean();
    if (!entity || !entity.isActive || entity.deleteDetails?.deleted) return [];
    return activeApplications(userId, entityId);
}
export { blockersFor };

async function tellStaffLeft(userId: string, entityId: unknown, movedTo?: string) {
    const u = await User.findById(userId).select("name").lean();
    await notifyCollege({
        entityId: oid(entityId), type: "campus_student_left", title: `${u?.name ?? "A student"} left the campus`,
        body: movedTo ? "They switched to another campus of their college." : undefined, link: `/employer/campus/${String(entityId)}/students`,
        actor: { kind: "student", id: oid(userId), name: u?.name ?? null },
    });
}

/** Leave the current campus. Blocked while any application is active; always allowed once the campus is gone. */
export async function leaveCampus(userId: string, confirm: boolean): Promise<Outcome> {
    const enrollment = await getEnrollment(userId);
    if (!enrollment?.entityId) return { ok: true }; // nothing to leave
    if (!confirm) return no(400, ERR.confirmRequired, "confirm_required");
    const prev = enrollment.entityId;
    const blockers = await blockersFor(userId, prev);
    if (blockers.length) return no(409, ERR.hasActiveApplications, "has_active_applications", { applications: blockers });
    const moved = await CampusEnrollment.updateOne({ _id: enrollment._id, entityId: prev }, { $set: { entityId: null, joinedAt: null } });
    if (moved.modifiedCount !== 1) return no(409, "Your campus just changed. Reload and try again.", "conflict");
    const late = await blockersFor(userId, prev);
    if (late.length) {
        await CampusEnrollment.updateOne({ _id: enrollment._id, entityId: null }, { $set: { entityId: prev, joinedAt: enrollment.joinedAt ?? null } });
        return no(409, ERR.hasActiveApplications, "has_active_applications", { applications: late });
    }
    await CampusEntity.updateOne({ _id: prev, studentCount: { $gt: 0 } }, { $inc: { studentCount: -1 } });
    await tellStaffLeft(userId, prev);
    return { ok: true };
}

// ── reports ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const reportSchema = z.object({
    reason: z.enum(CAMPUS_REPORT_REASONS),
    note: opt(z.string().trim().max(500)),
});

async function reportable(userId: string, entityId: string) {
    const enrollment = await getEnrollment(userId);
    if (!enrollment) return no(400, "Fill in your college details first.", "no_enrollment");
    if (!mongoose.isValidObjectId(entityId)) return no(404, "Campus not found", "not_found");
    const entity = await CampusEntity.findOne({ _id: entityId, ...live });
    // Only students of the same college may report it (no drive-by reports from elsewhere)
    if (!entity || !entity.collegeId.equals(enrollment.collegeId)) return no(404, "Campus not found", "not_found");
    return { ok: true as const, entity };
}

/** One report per student per campus; reporting again changes the reason. reportCount follows the real number of rows. */
export async function reportCampus(userId: string, entityId: string, input: z.infer<typeof reportSchema>): Promise<Outcome<{ reportCount: number }>> {
    const r = await reportable(userId, entityId);
    if (!r.ok) return r;
    let created = false;
    try {
        const prev = await CampusEntityReport.findOneAndUpdate(
            { entityId: r.entity._id, studentId: oid(userId) },
            { $set: { reason: input.reason, note: input.note ?? null } },
            { upsert: true, returnDocument: "before" },
        );
        created = prev === null;
    } catch (err) {
        if (!isDup(err)) throw err;
        await CampusEntityReport.updateOne({ entityId: r.entity._id, studentId: oid(userId) }, { $set: { reason: input.reason, note: input.note ?? null } });
    }
    const entity = created ? await CampusEntity.findByIdAndUpdate(r.entity._id, { $inc: { reportCount: 1 } }, { returnDocument: "after" }) : r.entity;
    if (created) {
        await notifyCollege({
            entityId: r.entity._id, type: "campus_entity_reported", title: "Students reported this campus",
            body: `${entity?.reportCount ?? 1} student${(entity?.reportCount ?? 1) === 1 ? "" : "s"} reported it as not the official campus of the college.`,
            link: `/employer/campus/${String(r.entity._id)}/overview`,
        });
    }
    return { ok: true, reportCount: entity?.reportCount ?? 0 };
}

export async function retractReport(userId: string, entityId: string): Promise<Outcome<{ reportCount: number }>> {
    const r = await reportable(userId, entityId);
    if (!r.ok) return r;
    const del = await CampusEntityReport.deleteOne({ entityId: r.entity._id, studentId: oid(userId) });
    const entity = del.deletedCount === 1
        ? await CampusEntity.findOneAndUpdate({ _id: r.entity._id, reportCount: { $gt: 0 } }, { $inc: { reportCount: -1 } }, { returnDocument: "after" })
        : r.entity;
    return { ok: true, reportCount: entity?.reportCount ?? 0 };
}

/** What a student sees about a campus they are about to join by code (no join code, no staff emails). */
export async function lookupByCode(userId: string, code: string): Promise<Outcome<{ campus: CampusSummary }>> {
    const enrollment = await getEnrollment(userId);
    if (!enrollment) return no(400, "Fill in your college details first.", "no_enrollment");
    const resolved = await resolveTarget(enrollment, { code });
    if (!resolved.ok) return resolved;
    const [campus] = await summarize([resolved.entity], userId, enrollment.entityId);
    return { ok: true, campus };
}

export type Banner = "none" | "no_entity" | "not_joined";

/** Everything the student campus area needs to render: details, college, current campus, and which banner to show. */
export async function campusState(userId: string) {
    const enrollment = await getEnrollment(userId);
    if (!enrollment) return { enrollment: null, college: null, current: null, entitiesExist: false, banner: "none" as Banner };
    const [college, { items, current }] = await Promise.all([
        College.findById(enrollment.collegeId).select("name").lean(),
        campusesFor(enrollment, userId),
    ]);
    const entitiesExist = items.some((i) => !i.joined) || items.length > 0;
    const banner: Banner = current ? "none" : entitiesExist ? "not_joined" : "no_entity";
    const e = enrollment.toObject();
    return {
        enrollment: {
            collegeId: String(e.collegeId), entityId: e.entityId ? String(e.entityId) : null, course: e.course, department: e.department, collegeUid: e.collegeUid,
            batch: e.batch, currentYear: e.currentYear ?? null, cgpa: e.cgpa ?? null, activeBacklogs: e.activeBacklogs ?? null, phone: e.phone ?? null,
            collegeEmail: e.collegeEmail ?? null, section: e.section ?? null, emailUpdates: e.emailUpdates, smsUpdates: e.smsUpdates,
        },
        college: college ? { _id: String(college._id), name: college.name } : null,
        current,
        entitiesExist,
        banner,
    };
}

/** Message preferences. SMS can only be switched on when a phone number is saved (and SMS itself is a stub for now). */
export async function setPreferences(userId: string, input: { emailUpdates?: boolean; smsUpdates?: boolean }): Promise<Outcome<{ emailUpdates: boolean; smsUpdates: boolean }>> {
    const enrollment = await getEnrollment(userId);
    if (!enrollment) return no(400, "Fill in your college details first.", "no_enrollment");
    if (input.smsUpdates === true && !enrollment.phone) return no(400, "Add your phone number in College details first.", "phone_required");
    const set: Record<string, boolean> = {};
    if (typeof input.emailUpdates === "boolean") set.emailUpdates = input.emailUpdates;
    if (typeof input.smsUpdates === "boolean") set.smsUpdates = input.smsUpdates;
    const updated = Object.keys(set).length ? await CampusEnrollment.findOneAndUpdate({ _id: enrollment._id }, { $set: set }, { returnDocument: "after" }) : enrollment;
    return { ok: true, emailUpdates: updated?.emailUpdates !== false, smsUpdates: updated?.smsUpdates === true };
}
