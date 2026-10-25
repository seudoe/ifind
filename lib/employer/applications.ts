import mongoose from "mongoose";
import { notify, notifyCompany } from "@/lib/employer/notify";
import Application, { type IApplication } from "@/models/Application";
import Company from "@/models/Company";
import PlatformInternship from "@/models/PlatformInternship";
import type { IPlatformInternship } from "@/models/PlatformInternship";
import User, { type IUser } from "@/models/User";
import {
    APPLICATION_STATUSES, APPLICATION_TRANSITIONS,
    type ApplicantSummary, type ApplicationStatus,
} from "@/types/employer";

type Id = string | mongoose.Types.ObjectId;

/**
 * Share of the internship's skills the student has (|intersection| / |internship skills|), 0-1.
 * ponytail: platform internships have no vectors yet, so this is skill overlap only. Once they are
 * vectorized, use the vectoriser's recommender.py scoring (0.4 TF-IDF + 0.6 BERT cosine) when both sides have vectors.
 */
export function computeMatchScore(studentSkills: string[], internshipSkills: string[]): number {
    const want = new Set(internshipSkills.map((s) => s.trim().toLowerCase()).filter(Boolean));
    if (!want.size) return 0;
    const have = new Set(studentSkills.map((s) => s.trim().toLowerCase()));
    let hit = 0;
    for (const s of want) if (have.has(s)) hit++;
    return Math.round((hit / want.size) * 100) / 100;
}

/** Frozen copy of the student's resume at apply time. */
export function buildResumeSnapshot(user: Pick<IUser, "skills" | "resume">) {
    const parsed = user.resume?.parsedData as { skills?: { tools?: { name?: string }[] }[] } | null | undefined;
    const fromResume = (parsed?.skills ?? []).flatMap((s) => (s.tools ?? []).map((t) => t.name ?? ""));
    const skills = [...new Set([...(user.skills ?? []), ...fromResume].map((s) => s.trim()).filter(Boolean))].slice(0, 60);
    return { url: user.resume?.driveViewLink ?? null, parsedData: user.resume?.parsedData ?? null, skills };
}

/**
 * Creates an application and notifies the company. This is the one place that does it, so the seed
 * script and the future student apply API behave the same. Throws on duplicate / full / closed.
 */
export async function createApplication(
    internship: Pick<IPlatformInternship, "_id" | "companyId" | "name" | "skills" | "maxApplications" | "status">,
    user: IUser,
    extra: {
        coverLetter?: string;
        answers?: IApplication["answers"];
        note?: string;
        /** What the student confirmed in the apply pop-up; anything omitted falls back to their profile. */
        applicant?: { name?: string; phone?: string | null; city?: string | null; state?: string | null; skills?: string[]; profileUpdated?: boolean };
    } = {},
) {
    if (internship.status !== "published") throw new Error("This internship is not accepting applications");
    if (internship.maxApplications) {
        const n = await Application.countDocuments({ internshipId: internship._id });
        if (n >= internship.maxApplications) throw new Error("This internship reached its maximum applications");
    }
    const snapshot = buildResumeSnapshot(user);
    const a = extra.applicant ?? {};
    const applicantSnapshot = {
        name: a.name || user.name,
        email: user.email,
        phone: a.phone === undefined ? user.phone ?? null : a.phone,
        city: a.city === undefined ? user.city ?? null : a.city,
        state: a.state === undefined ? user.state ?? null : a.state,
        skills: a.skills ?? snapshot.skills,
        profileUpdated: a.profileUpdated === true,
    };
    const doc = await Application.create({
        internshipId: internship._id,
        companyId: internship.companyId,
        studentId: user._id,
        status: "applied",
        statusHistory: [{ status: "applied", changedBy: null, changedAt: new Date(), note: extra.note ?? null }],
        resumeSnapshot: snapshot,
        applicantSnapshot,
        coverLetter: extra.coverLetter ?? null,
        answers: extra.answers ?? [],
        matchScore: computeMatchScore(applicantSnapshot.skills, internship.skills ?? []),
    });

    await notifyCompany({
        companyId: internship.companyId,
        type: "new_application",
        title: `New application for "${internship.name}"`,
        body: `${applicantSnapshot.name} applied.`,
        link: `/employer/company/${internship.companyId}/internships/${internship._id}/applicants`,
        actor: { kind: "student", id: user._id as mongoose.Types.ObjectId, name: applicantSnapshot.name },
    });
    return doc;
}

interface ListOptions {
    companyId: Id;
    internshipId?: Id;
    status?: string;
    q?: string;
    sort?: string;
}

const oid = (v: Id) => new mongoose.Types.ObjectId(String(v));

/** ATS rows (+ pipeline counts that ignore the status/search filters). Capped at 500 rows. */
export async function listApplicants(o: ListOptions) {
    const scope: Record<string, unknown> = { companyId: oid(o.companyId) };
    if (o.internshipId) scope.internshipId = oid(o.internshipId);

    const match: Record<string, unknown> = { ...scope };
    if (o.status && (APPLICATION_STATUSES as readonly string[]).includes(o.status)) match.status = o.status;

    const q = o.q?.trim();
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const sort: Record<string, 1 | -1> =
        o.sort === "match" ? { matchScore: -1, appliedAt: -1 } : o.sort === "rating" ? { rating: -1, appliedAt: -1 } : { appliedAt: -1 };

    const [rows, countRows] = await Promise.all([
        Application.aggregate([
            { $match: match },
            { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student", pipeline: [{ $project: { name: 1, email: 1, profilePicture: 1 } }] } },
            { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
            ...(rx ? [{ $match: { $or: [{ "student.name": rx }, { "applicantSnapshot.name": rx }, { "student.email": rx }, { "resumeSnapshot.skills": rx }, { "applicantSnapshot.skills": rx }] } }] : []),
            { $sort: sort },
            { $limit: 500 },
            { $lookup: { from: "internships.this-platform", localField: "internshipId", foreignField: "_id", as: "internship", pipeline: [{ $project: { name: 1 } }] } },
            { $unwind: { path: "$internship", preserveNullAndEmptyArrays: true } },
        ]),
        Application.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);

    const items: ApplicantSummary[] = rows.map((r) => ({
        _id: String(r._id),
        internshipId: String(r.internshipId),
        internshipName: r.internship?.name,
        studentId: String(r.studentId),
        studentName: r.applicantSnapshot?.name ?? r.student?.name ?? "Unknown student",
        studentEmail: r.student?.email,
        studentPicture: r.student?.profilePicture ?? null,
        skills: r.applicantSnapshot?.skills ?? r.resumeSnapshot?.skills ?? [],
        matchScore: r.matchScore ?? null,
        status: r.status,
        rating: r.rating ?? null,
        appliedAt: new Date(r.appliedAt).toISOString(),
    }));
    return { items, counts: Object.fromEntries(countRows.map((c) => [c._id, c.n])) as Record<string, number> };
}

export type TransitionResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Moves one application along the pipeline. The allowed-transition map is the only authority;
 * the update is conditional on the status we read, so a concurrent change can't be overwritten.
 */
export async function changeStatus(
    app: Pick<IApplication, "_id" | "status">,
    companyId: Id,
    to: ApplicationStatus,
    employerId: Id,
    note?: string | null,
): Promise<TransitionResult> {
    if (!APPLICATION_TRANSITIONS[app.status].includes(to)) {
        return { ok: false, status: 400, error: `Can't move an application from ${app.status} to ${to}` };
    }
    const res = await Application.updateOne(
        { _id: app._id, companyId, status: app.status },
        { $set: { status: to }, $push: { statusHistory: { status: to, changedBy: employerId, changedAt: new Date(), note: note || null } } },
    );
    if (!res.modifiedCount) return { ok: false, status: 409, error: "The application changed, refresh and try again" };
    await syncStudent(app._id, to);
    return { ok: true };
}

/** Student-side enum on `user.appliedInternships[].status` for each pipeline status. */
const STUDENT_STATUS: Partial<Record<ApplicationStatus, IUser["appliedInternships"][number]["status"]>> = {
    applied: "applied", under_review: "applied", rejected: "rejected", hired: "selected",
    shortlisted: "shortlisted", interview: "shortlisted", offered: "shortlisted",
};
const STUDENT_MESSAGE: Partial<Record<ApplicationStatus, string>> = {
    shortlisted: "You've been shortlisted", interview: "You're invited to interview", offered: "You received an offer",
    hired: "You've been selected", rejected: "Your application was not taken forward",
};

/** Mirrors a status change onto the student (their applied list) and tells them. Never throws. */
async function syncStudent(applicationId: Id, to: ApplicationStatus) {
    try {
        const a = await Application.findById(applicationId).select("studentId internshipId companyId").lean();
        if (!a) return;
        const mapped = STUDENT_STATUS[to];
        if (mapped) {
            await User.updateOne({ _id: a.studentId, "appliedInternships.internshipId": a.internshipId }, { $set: { "appliedInternships.$.status": mapped } });
        }
        const msg = STUDENT_MESSAGE[to];
        if (!msg) return;
        const [internship, user] = await Promise.all([
            PlatformInternship.findById(a.internshipId).select("name company").lean(),
            User.findById(a.studentId).select("username").lean(),
        ]);
        await notify({
            recipientType: "student",
            recipientIds: [a.studentId],
            type: "application_status",
            title: `${msg}: ${internship?.name ?? "an internship"}`,
            body: internship?.company ? `${internship.company} updated your application.` : undefined,
            link: user?.username ? `/user/${user.username}/applied-internships/${a.internshipId}` : undefined,
            companyId: a.companyId,
        });
    } catch (err) {
        console.error("[syncStudent]", err);
    }
}
