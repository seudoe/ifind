import mongoose from "mongoose";
import { CAMPUS_ACTIVE_STATUSES, type CampusApplicationStatus } from "@/types/campus";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));

export interface CampusAppliedItem {
    applicationId: string;
    internshipId: string;
    company: string;
    designation: string;
    status: CampusApplicationStatus;
    appliedAt: string;
    canWithdraw: boolean;
    acceptBy: string | null;
}

/** The student's campus applications. They stay visible after leaving a campus (records are kept). Student-safe fields only. */
export async function loadCampusApplied(userId: string): Promise<CampusAppliedItem[]> {
    const apps = await CampusApplication.find({ studentId: oid(userId) }).sort({ appliedAt: -1 }).limit(200).select("-notes -rating -resumeSnapshot").lean();
    if (!apps.length) return [];
    const interns = await CampusInternship.find({ _id: { $in: apps.map((a) => a.internshipId) } }).select("company.name designation").lean();
    const byId = new Map(interns.map((i) => [String(i._id), i]));
    return apps.map((a) => {
        const i = byId.get(String(a.internshipId));
        return {
            applicationId: String(a._id), internshipId: String(a.internshipId), company: i?.company.name ?? "Internship", designation: i?.designation ?? "",
            status: a.status, appliedAt: new Date(a.appliedAt).toISOString(), canWithdraw: CAMPUS_ACTIVE_STATUSES.includes(a.status),
            acceptBy: a.status === "offered" && a.offer?.acceptBy ? new Date(a.offer.acceptBy).toISOString() : null,
        };
    });
}

export async function loadCampusApplication(userId: string, applicationId: string) {
    if (!mongoose.isValidObjectId(applicationId)) return null;
    const a = await CampusApplication.findOne({ _id: applicationId, studentId: oid(userId) }).select("-notes -rating -resumeSnapshot").lean();
    if (!a) return null;
    const i = await CampusInternship.findById(a.internshipId).lean();
    const qs = new Map((i?.screeningQuestions ?? []).map((q) => [String(q._id), q.question]));
    return {
        applicationId: String(a._id),
        internshipId: String(a.internshipId),
        status: a.status,
        appliedAt: new Date(a.appliedAt).toISOString(),
        canWithdraw: CAMPUS_ACTIVE_STATUSES.includes(a.status),
        // Timeline carries no staff identity or private note: only what happened and when (a removal reason is shown to the student)
        timeline: a.statusHistory.map((h) => ({ status: h.status, at: new Date(h.changedAt).toISOString(), byYou: !!h.byStudent })),
        rounds: a.rounds.map((r) => ({ name: r.name, result: r.result, at: r.at ? new Date(r.at).toISOString() : null })),
        removalReason: a.status === "removed" ? a.removal?.reason ?? null : null,
        offer: a.offer ? { acceptBy: a.offer.acceptBy ? new Date(a.offer.acceptBy).toISOString() : null, respondedAt: a.offer.respondedAt ? new Date(a.offer.respondedAt).toISOString() : null } : null,
        coverLetter: a.coverLetter ?? null,
        answers: a.answers.map((x) => ({ question: qs.get(String(x.questionId)) ?? "Question", answer: Array.isArray(x.answer) ? x.answer.join(", ") : String(x.answer ?? "") })),
        internship: i ? {
            company: i.company.name, designation: i.designation, description: i.description, deadlineDate: i.deadlineDate ?? null, interviewDate: i.interviewDate ?? null,
            assessmentDate: i.assessmentDate ?? null, resultDate: i.resultDate ?? null, duration: i.duration ?? null, stipend: i.stipend ?? null, status: i.status,
        } : null,
    };
}
