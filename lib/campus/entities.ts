import mongoose from "mongoose";
import CampusEntity, { type ICampusEntity } from "@/models/CampusEntity";
import CampusInternship from "@/models/CampusInternship";
import CampusApplication from "@/models/CampusApplication";
import College from "@/models/College";
import Company from "@/models/Company";
import { CAMPUS_ACTIVE_STATUSES } from "@/types/campus";
import { uniqueJoinCode } from "./joinCode";
import type { CampusCreateInput, CampusProfileInput } from "./validation";

export const MAX_CAMPUSES_PER_EMPLOYER = 10;

/** "TCET Placement Cell" -> "tcet-placement-cell", with -2, -3… appended on collision. */
export async function uniqueCampusSlug(name: string): Promise<string> {
    const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "campus";
    let slug = base;
    for (let n = 2; await CampusEntity.exists({ slug }); n++) slug = `${base}-${n}`;
    return slug;
}

const codeTaken = async (code: string) => !!(await CampusEntity.exists({ joinCode: code }));

export type CreateResult = { ok: true; entity: ICampusEntity } | { ok: false; error: string; status: number };

/** Creates an entity with the employer as sole owner. Many entities per college are allowed on purpose. */
export async function createCampusEntity(employerId: mongoose.Types.ObjectId, input: CampusCreateInput): Promise<CreateResult> {
    const college = await College.findById(input.collegeId).select("_id").lean();
    if (!college) return { ok: false, error: "That college was not found", status: 400 };

    const owned = await CampusEntity.countDocuments({ createdBy: employerId, "deleteDetails.deleted": { $ne: true } });
    if (owned >= MAX_CAMPUSES_PER_EMPLOYER) return { ok: false, error: `You can create at most ${MAX_CAMPUSES_PER_EMPLOYER} campuses`, status: 400 };

    // Slug and code uniqueness are enforced by unique indexes; retry on a race.
    for (let attempt = 0; ; attempt++) {
        try {
            const entity = await CampusEntity.create({
                ...input,
                collegeId: college._id,
                slug: await uniqueCampusSlug(input.name),
                joinCode: await uniqueJoinCode(codeTaken),
                createdBy: employerId,
                members: [{ employerId, role: "owner", addedBy: employerId }],
            });
            return { ok: true, entity };
        } catch (err) {
            const dup = typeof err === "object" && err && "code" in err && err.code === 11000;
            if (!dup || attempt >= 3) throw err;
        }
    }
}

export async function updateCampusProfile(entity: ICampusEntity, input: CampusProfileInput): Promise<void> {
    entity.set(input);
    await entity.save();
}

/** New code; the old one stops working at once (the lookup is by the current value only). */
export async function rotateJoinCode(entity: ICampusEntity): Promise<string> {
    for (let attempt = 0; ; attempt++) {
        try {
            const joinCode = await uniqueJoinCode(codeTaken);
            await CampusEntity.updateOne({ _id: entity._id }, { $set: { joinCode } });
            return joinCode;
        } catch (err) {
            const dup = typeof err === "object" && err && "code" in err && err.code === 11000;
            if (!dup || attempt >= 3) throw err;
        }
    }
}

export interface InstituteRow {
    kind: "company" | "college";
    _id: string;
    name: string;
    logo: string | null;
    role: string;
    /** company: verification status; college: restriction status. */
    status: string;
    createdAt: Date;
    /** company: published internships; college: open internships. */
    openInternships: number;
    newApplicants: number;
    /** college only. */
    studentsJoined?: number;
    members?: number;
    collegeName?: string | null;
}

/** One list of everything the employer belongs to: companies and college campuses. */
export async function listInstitutes(employerId: mongoose.Types.ObjectId): Promise<InstituteRow[]> {
    const Application = (await import("@/models/Application")).default;
    const PlatformInternship = (await import("@/models/PlatformInternship")).default;
    const live = { isActive: true, "deleteDetails.deleted": { $ne: true } };

    const [companies, campuses] = await Promise.all([
        Company.find({ "members.employerId": employerId, ...live }).sort({ createdAt: -1 }).lean(),
        CampusEntity.find({ "members.employerId": employerId, ...live }).sort({ createdAt: -1 }).lean(),
    ]);
    const cids = companies.map((c) => c._id);
    const eids = campuses.map((c) => c._id);
    const group = (field: string) => ({ _id: `$${field}`, n: { $sum: 1 } });

    const [published, applicants, open, newApps, colleges] = await Promise.all([
        PlatformInternship.aggregate<{ _id: unknown; n: number }>([{ $match: { companyId: { $in: cids }, status: "published" } }, { $group: group("companyId") }]),
        Application.aggregate<{ _id: unknown; n: number }>([{ $match: { companyId: { $in: cids }, status: "applied" } }, { $group: group("companyId") }]),
        CampusInternship.aggregate<{ _id: unknown; n: number }>([{ $match: { entityId: { $in: eids }, status: "open" } }, { $group: group("entityId") }]),
        CampusApplication.aggregate<{ _id: unknown; n: number }>([{ $match: { entityId: { $in: eids }, status: "applied" } }, { $group: group("entityId") }]),
        College.find({ _id: { $in: campuses.map((c) => c.collegeId) } }).select("name").lean(),
    ]);
    const count = (rows: { _id: unknown; n: number }[], id: unknown) => rows.find((r) => String(r._id) === String(id))?.n ?? 0;
    const collegeName = new Map(colleges.map((c) => [String(c._id), c.name]));
    const mine = (members: { employerId: unknown; role: string }[]) => members.find((m) => String(m.employerId) === String(employerId))?.role ?? "viewer";

    const rows: InstituteRow[] = [
        ...companies.map<InstituteRow>((c) => ({
            kind: "company", _id: String(c._id), name: c.name, logo: c.logo ?? null, role: mine(c.members),
            status: c.verification?.status ?? "unverified", createdAt: c.createdAt,
            openInternships: count(published, c._id), newApplicants: count(applicants, c._id),
        })),
        ...campuses.map<InstituteRow>((c) => ({
            kind: "college", _id: String(c._id), name: c.name, logo: c.logo ?? null, role: mine(c.members),
            status: c.restriction?.status ?? "none", createdAt: c.createdAt,
            openInternships: count(open, c._id), newApplicants: count(newApps, c._id),
            studentsJoined: c.studentCount ?? 0, members: c.members.length, collegeName: collegeName.get(String(c.collegeId)) ?? null,
        })),
    ];
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Other campuses of the same college that students could confuse with a new one (never exposes join codes). */
export async function otherCampusesOfCollege(collegeId: string) {
    const rows = await CampusEntity.find({ collegeId, listing: "listed", isActive: true, "deleteDetails.deleted": { $ne: true } })
        .select("name createdAt members reportCount")
        .sort({ createdAt: 1 })
        .limit(20)
        .lean();
    return rows.map((r) => ({ _id: String(r._id), name: r.name, createdAt: r.createdAt, members: r.members.length, reportCount: r.reportCount ?? 0 }));
}

/** Count of the entity's applicants still in play (used by overview). */
export const activeApplicantCount = (entityId: mongoose.Types.ObjectId) =>
    CampusApplication.countDocuments({ entityId, status: { $in: CAMPUS_ACTIVE_STATUSES } });
