import mongoose from "mongoose";
import { closeCampusEntity } from "./deletion";
import { notifyCollege } from "./notify";
import { sendToStaff } from "./outbound";
import { escapeRegex } from "./validation";
import type { Outcome } from "./student";
import BanEvent from "@/models/BanEvent";
import CampusApplication from "@/models/CampusApplication";
import CampusBlacklist from "@/models/CampusBlacklist";
import CampusEntity from "@/models/CampusEntity";
import CampusEntityReport from "@/models/CampusEntityReport";
import CampusInternship from "@/models/CampusInternship";
import College from "@/models/College";
import Employer from "@/models/Employer";
import User from "@/models/User";
import { CAMPUS_RESTRICTIONS, type CampusRestriction } from "@/types/campus";

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));
const no = (status: number, error: string, code?: string): Outcome<never> => ({ ok: false, status, error, code });

export type ModAction = "restrict" | "ban" | "lift";

export interface ModCampusRow {
    _id: string;
    name: string;
    college: string | null;
    restriction: { status: CampusRestriction; reason?: string | null; at?: string | null };
    reportCount: number;
    studentCount: number;
    memberCount: number;
    internshipCount: number;
    creator: string;
    isActive: boolean;
    deleted: boolean;
    createdAt: string;
}

/** Moderator list. `status` = none | restricted | banned | reported (any report). Default sort: most reported first. */
export async function listCampusesForModeration(o: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, o.page ?? 1);
    const limit = Math.min(100, Math.max(1, o.limit ?? 20));
    const query: Record<string, unknown> = {};
    const search = o.search?.trim().slice(0, 80);
    if (search) {
        const re = new RegExp(escapeRegex(search), "i");
        const colleges = await College.find({ name: re }).select("_id").limit(50).lean();
        query.$or = [{ name: re }, { slug: re }, { contactEmail: re }, { collegeId: { $in: colleges.map((c) => c._id) } }];
    }
    if (o.status === "reported") query.reportCount = { $gt: 0 };
    else if ((CAMPUS_RESTRICTIONS as readonly string[]).includes(o.status ?? "")) query["restriction.status"] = o.status === "none" ? { $in: ["none", null] } : o.status;

    const [total, rows] = await Promise.all([
        CampusEntity.countDocuments(query),
        CampusEntity.find(query).sort({ reportCount: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    const [colleges, creators, interns] = await Promise.all([
        College.find({ _id: { $in: rows.map((r) => r.collegeId) } }).select("name").lean(),
        Employer.find({ _id: { $in: rows.map((r) => r.createdBy) } }).select("name").lean(),
        CampusInternship.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { entityId: { $in: rows.map((r) => r._id) } } }, { $group: { _id: "$entityId", n: { $sum: 1 } } }]),
    ]);
    const cName = new Map(colleges.map((c) => [String(c._id), c.name]));
    const eName = new Map(creators.map((c) => [String(c._id), c.name]));
    const iCount = new Map(interns.map((i) => [String(i._id), i.n]));
    const data: ModCampusRow[] = rows.map((r) => ({
        _id: String(r._id), name: r.name, college: cName.get(String(r.collegeId)) ?? null,
        restriction: { status: r.restriction?.status ?? "none", reason: r.restriction?.reason ?? null, at: r.restriction?.at ? new Date(r.restriction.at).toISOString() : null },
        reportCount: r.reportCount ?? 0, studentCount: r.studentCount ?? 0, memberCount: r.members.length, internshipCount: iCount.get(String(r._id)) ?? 0,
        creator: eName.get(String(r.createdBy)) ?? "Unknown", isActive: r.isActive, deleted: !!r.deleteDetails?.deleted, createdAt: r.createdAt.toISOString(),
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function campusModerationDetail(id: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    const e = await CampusEntity.findById(id).lean();
    if (!e) return null;
    const [college, people, reports, history, applications, banned, internships] = await Promise.all([
        College.findById(e.collegeId).select("name").lean(),
        Employer.find({ _id: { $in: e.members.map((m) => m.employerId) } }).select("name email isBanned").lean(),
        CampusEntityReport.find({ entityId: e._id }).sort({ createdAt: -1 }).limit(100).lean(),
        BanEvent.find({ userId: e._id, targetType: "campus" }).sort({ at: -1 }).limit(50).lean(),
        CampusApplication.countDocuments({ entityId: e._id }),
        CampusBlacklist.countDocuments({ entityId: e._id, active: true }),
        CampusInternship.countDocuments({ entityId: e._id }),
    ]);
    const students = await User.find({ _id: { $in: reports.map((r) => r.studentId) } }).select("name").lean();
    const sName = new Map(students.map((s) => [String(s._id), s.name]));
    const byId = new Map(people.map((p) => [String(p._id), p]));
    return {
        campus: {
            _id: String(e._id), name: e.name, slug: e.slug, description: e.description, college: college?.name ?? null, listing: e.listing,
            restriction: { status: e.restriction?.status ?? "none", reason: e.restriction?.reason ?? null, at: e.restriction?.at ?? null },
            reportCount: e.reportCount ?? 0, studentCount: e.studentCount ?? 0, isActive: e.isActive, deleted: !!e.deleteDetails?.deleted, createdAt: e.createdAt,
        },
        members: e.members.map((m) => ({ employerId: String(m.employerId), role: m.role, name: byId.get(String(m.employerId))?.name ?? "(deleted)", email: byId.get(String(m.employerId))?.email ?? "", isBanned: byId.get(String(m.employerId))?.isBanned ?? false })),
        // Moderators see who reported and why; students never see each other's reports
        reports: reports.map((r) => ({ reason: r.reason, note: r.note ?? null, student: sName.get(String(r.studentId)) ?? "(deleted)", at: r.createdAt })),
        history: JSON.parse(JSON.stringify(history)),
        counts: { applications, barredStudents: banned, internships },
    };
}

/**
 * restrict: the campus cannot post, email or accept joins until lifted (existing data stays).
 * ban:      restrict + internships closed, applications withdrawn, students detached (they rejoin elsewhere).
 * lift:     back to normal. After a ban the staff re-open internships and students rejoin with the code.
 * Each transition is conditional on the current status, so two moderators cannot both apply it.
 */
export async function moderateCampus(id: string, action: ModAction, reason: string, moderator: { id: unknown; name: string }): Promise<Outcome<{ status: CampusRestriction; studentsDetached: number }>> {
    if (!mongoose.isValidObjectId(id)) return no(404, "Campus not found", "not_found");
    const why = reason.trim().slice(0, 500);
    if (action !== "lift" && !why) return no(400, "A reason is required.", "reason_required");
    const entity = await CampusEntity.findById(id);
    if (!entity) return no(404, "Campus not found", "not_found");
    if (entity.deleteDetails?.deleted) return no(409, "This campus was deleted by its owner.", "deleted");

    const prev: CampusRestriction = entity.restriction?.status ?? "none";
    const next: CampusRestriction = action === "lift" ? "none" : action === "ban" ? "banned" : "restricted";
    if (prev === next) return no(409, next === "none" ? "This campus is not restricted." : `Already ${next}.`, "no_change");

    const now = new Date();
    const res = await CampusEntity.updateOne(
        { _id: entity._id, $or: [{ "restriction.status": prev }, ...(prev === "none" ? [{ "restriction.status": null }, { restriction: { $exists: false } }] : [])] },
        { $set: { restriction: next === "none" ? { status: "none", reason: null, by: null, at: null } : { status: next, reason: why, by: oid(moderator.id), at: now } } },
    );
    if (res.modifiedCount !== 1) return no(409, "Someone else just changed this campus. Reload and try again.", "conflict");

    let detached = 0;
    if (next === "banned") detached = (await closeCampusEntity({ _id: entity._id, name: entity.name }, "banned")).students;

    try {
        await BanEvent.create({ userId: entity._id, targetType: "campus", action: next === "none" ? "unban" : "ban", reason: next === "none" ? why || null : `[${next}] ${why}`, moderatorId: oid(moderator.id), moderatorName: moderator.name, at: now });
    } catch (e) {
        console.error("[moderateCampus] could not write history", e);
    }

    const title = next === "none" ? `${entity.name} was restored` : next === "banned" ? `${entity.name} was banned` : `${entity.name} was restricted`;
    const body = next === "none"
        ? "You can post, email students and accept joins again." + (prev === "banned" ? " Students were detached by the ban: re-open your internships and share your join code." : "")
        : `${why}. It cannot post, email students or accept joins${next === "banned" ? ", and its internships were closed and students detached" : " until the restriction is lifted"}.`;
    await notifyCollege({ entityId: entity._id, type: "campus_restriction", title, body, link: `/employer/campus/${String(entity._id)}/overview`, actor: { kind: "moderator", id: null, name: "iFind moderation" } });
    const people = await Employer.find({ _id: { $in: entity.members.map((m) => m.employerId) }, isBanned: { $ne: true } }).select("email name").lean();
    await sendToStaff(
        people.map((p) => ({ id: String(p._id), email: p.email, name: p.name })),
        () => ({ subject: title, text: body, link: `/employer/campus/${String(entity._id)}/overview` }),
        { email: true, kind: "campus-restriction", refId: String(entity._id), version: `${next}:${now.getTime()}`, entityId: String(entity._id), bypassRestriction: true },
    );
    return { ok: true, status: next, studentsDetached: detached };
}
