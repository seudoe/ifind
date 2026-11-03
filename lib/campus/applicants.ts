import mongoose from "mongoose";
import { escapeRegex } from "./validation";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";
import { CAMPUS_APPLICATION_STATUSES } from "@/types/campus";

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));

export interface ApplicantRow {
    _id: string;
    internshipId: string;
    company: string;
    designation: string;
    status: string;
    name: string;
    uid: string;
    course: string;
    department: string;
    batch: number;
    cgpa: number | null;
    rating: number | null;
    appliedAt: string;
    currentRound: string | null;
}

/** Staff list: scoped by the verified entity; optional internship, status and text filter. Pipeline counts ignore filters. */
export async function listCampusApplicants(entityId: unknown, o: { internshipId?: string; status?: string; q?: string } = {}) {
    const scope: Record<string, unknown> = { entityId: oid(entityId) };
    if (o.internshipId && mongoose.isValidObjectId(o.internshipId)) scope.internshipId = oid(o.internshipId);
    const match: Record<string, unknown> = { ...scope };
    if (o.status && (CAMPUS_APPLICATION_STATUSES as readonly string[]).includes(o.status)) match.status = o.status;

    const q = o.q?.trim().slice(0, 80);
    const rx = q ? new RegExp(escapeRegex(q), "i") : null;
    const [rows, counts] = await Promise.all([
        CampusApplication.aggregate([
            { $match: match },
            ...(rx ? [{ $match: { $or: [{ "applicantSnapshot.name": rx }, { "applicantSnapshot.uid": rx }, { "applicantSnapshot.course": rx }, { "applicantSnapshot.department": rx }, { "applicantSnapshot.email": rx }] } }] : []),
            { $sort: { appliedAt: -1 } },
            { $limit: 500 },
        ]),
        CampusApplication.aggregate<{ _id: string; n: number }>([{ $match: scope }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    const interns = await CampusInternship.find({ entityId: oid(entityId), _id: { $in: [...new Set(rows.map((r) => String(r.internshipId)))] } }).select("company.name designation").lean();
    const byId = new Map(interns.map((i) => [String(i._id), i]));
    const items: ApplicantRow[] = rows.map((r) => {
        const i = byId.get(String(r.internshipId));
        const s = r.applicantSnapshot;
        return {
            _id: String(r._id), internshipId: String(r.internshipId), company: i?.company.name ?? "", designation: i?.designation ?? "", status: r.status,
            name: s.name, uid: s.uid, course: s.course, department: s.department, batch: s.batch, cgpa: s.cgpa ?? null, rating: r.rating ?? null,
            appliedAt: new Date(r.appliedAt).toISOString(), currentRound: r.currentRound ?? null,
        };
    });
    return { items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
}

/** Full applicant view for the drawer (staff only: includes notes and rating). */
export async function campusApplicantDetail(entityId: unknown, applicationId: string) {
    if (!mongoose.isValidObjectId(applicationId)) return null;
    const a = await CampusApplication.findOne({ _id: applicationId, entityId: oid(entityId) }).lean();
    if (!a) return null;
    const internship = await CampusInternship.findOne({ _id: a.internshipId, entityId: oid(entityId) }).lean();
    const qs = new Map((internship?.screeningQuestions ?? []).map((q) => [String(q._id), q.question]));
    const ser = JSON.parse(JSON.stringify(a));
    return {
        ...ser,
        resumeSnapshot: { url: a.resumeSnapshot?.url ?? null, skills: a.resumeSnapshot?.skills ?? [] },
        internship: internship ? { _id: String(internship._id), company: internship.company.name, designation: internship.designation, rounds: internship.rounds.map((r) => r.name) } : null,
        answers: a.answers.map((x) => ({ question: qs.get(String(x.questionId)) ?? "Question", answer: Array.isArray(x.answer) ? x.answer.join(", ") : String(x.answer ?? "") })),
    };
}
