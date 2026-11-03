import mongoose from "mongoose";
import { z } from "zod";
import { isEligible } from "./eligibility";
import { syncCampusAutoClose } from "./internships";
import { notifyCollege } from "./notify";
import { getEnrollment, type Outcome } from "./student";
import { buildResumeSnapshot } from "@/lib/employer/applications";
import { validateAnswers } from "@/lib/employer/screening";
import CampusApplication from "@/models/CampusApplication";
import CampusBlacklist from "@/models/CampusBlacklist";
import CampusEntity from "@/models/CampusEntity";
import CampusInternship from "@/models/CampusInternship";
import User from "@/models/User";

export const applySchema = z.object({
    coverLetter: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(5000).optional()),
    answers: z.array(z.object({ questionId: z.string(), answer: z.unknown() })).max(10).default([]),
    /** "My details are correct": the student confirmed the snapshot that staff will see. */
    confirm: z.literal(true, { message: "Please confirm your details are correct" }),
});
export type ApplyInput = z.infer<typeof applySchema>;

const fail = (status: number, error: string, code: string, extra?: Record<string, unknown>): Outcome<never> => ({ ok: false, status, error, code, extra });

/**
 * Apply to a campus internship. Every block of 6.6 is enforced here, in this order:
 * not joined (the internship must belong to the student's OWN campus), campus restricted, not open / past deadline,
 * on this campus's blacklist, removed by staff, already applied, ineligible, resume missing, full, bad answers.
 */
export async function applyToCampusInternship(userId: string, internshipId: string, input: ApplyInput): Promise<Outcome<{ applicationId: string }>> {
    const enrollment = await getEnrollment(userId);
    if (!enrollment?.entityId) return fail(403, "Join your college's campus to apply.", "not_joined");
    if (!mongoose.isValidObjectId(internshipId)) return fail(404, "Internship not found", "not_found");
    // The campus comes from the enrollment. An internship of another campus looks like it does not exist.
    const internship = await CampusInternship.findOne({ _id: internshipId, entityId: enrollment.entityId });
    if (!internship) return fail(404, "Internship not found", "not_found");

    const entity = await CampusEntity.findOne({ _id: enrollment.entityId, isActive: true, "deleteDetails.deleted": { $ne: true } }).select("restriction").lean();
    if (!entity) return fail(403, "This campus is no longer available.", "not_joined");
    if (entity.restriction?.status && entity.restriction.status !== "none") return fail(403, "This campus can't take applications right now.", "restricted");

    await syncCampusAutoClose(enrollment.entityId);
    const fresh = await CampusInternship.findById(internship._id);
    if (!fresh || fresh.status !== "open") return fail(409, "This internship is closed.", "closed");
    if (fresh.deadlineDate && fresh.deadlineDate < new Date()) return fail(409, "The application deadline has passed.", "closed");

    const ban = await CampusBlacklist.findOne({ entityId: enrollment.entityId, studentId: enrollment.userId, active: true }).select("reason").lean();
    if (ban) return fail(403, `You can't apply to internships of this campus. Reason: ${ban.reason}`, "banned", { reason: ban.reason });

    const existing = await CampusApplication.findOne({ internshipId: fresh._id, studentId: enrollment.userId });
    if (existing?.status === "removed") return fail(403, "Campus staff removed you from this internship. Ask them to reinstate you.", "removed");
    if (existing && existing.status !== "withdrawn") return fail(409, "You have already applied to this internship.", "already_applied");

    const verdict = isEligible(enrollment, fresh.eligibility);
    if (!verdict.ok) return fail(422, "You are not eligible for this internship.", "ineligible", { reasons: verdict.reasons });

    const user = await User.findById(userId);
    if (!user) return fail(401, "Not authenticated", "unauthenticated");
    if (fresh.requireResume && !user.resume?.driveViewLink && !user.resume?.parsedData) return fail(422, "Upload your resume first. This internship needs one.", "resume_required");

    if (fresh.maxApplications) {
        const n = await CampusApplication.countDocuments({ internshipId: fresh._id, status: { $ne: "withdrawn" } });
        if (n >= fresh.maxApplications) return fail(409, "This internship has reached its maximum number of applications.", "full");
    }

    const checked = validateAnswers(fresh.screeningQuestions, input.answers);
    if ("error" in checked) return fail(400, checked.error, "bad_answers");

    const now = new Date();
    const snapshot = {
        name: user.name, uid: enrollment.collegeUid, course: enrollment.course, department: enrollment.department, batch: enrollment.batch,
        cgpa: enrollment.cgpa ?? null, activeBacklogs: enrollment.activeBacklogs ?? null, phone: enrollment.phone ?? user.phone ?? null, email: user.email,
    };
    const data = {
        status: "applied" as const, currentRound: null, rounds: [], resumeSnapshot: buildResumeSnapshot(user), applicantSnapshot: snapshot,
        coverLetter: input.coverLetter ?? null,
        answers: checked.answers.map((a) => ({ questionId: new mongoose.Types.ObjectId(a.questionId), answer: a.answer })), appliedAt: now, removal: null, offer: null,
    };

    let appId: mongoose.Types.ObjectId;
    try {
        if (existing) {
            // Re-applying after a withdrawal reuses the record: the unique (internship, student) index allows one
            const res = await CampusApplication.updateOne(
                { _id: existing._id, status: "withdrawn" },
                { $set: data, $push: { statusHistory: { status: "applied", changedAt: now, byStudent: true, note: "Applied again" } } },
            );
            if (res.modifiedCount !== 1) return fail(409, "You have already applied to this internship.", "already_applied");
            appId = existing._id;
        } else {
            const doc = await CampusApplication.create({
                ...data, entityId: enrollment.entityId, internshipId: fresh._id, studentId: enrollment.userId, enrollmentId: enrollment._id,
                statusHistory: [{ status: "applied", changedAt: now, byStudent: true }],
            });
            appId = doc._id;
        }
    } catch (err) {
        if (typeof err === "object" && err && "code" in err && err.code === 11000) return fail(409, "You have already applied to this internship.", "already_applied");
        throw err;
    }

    // Races: the student left the campus, or the last seat was taken, between the checks above and the write
    const stillThere = await getEnrollment(userId);
    // The cap goes to the earliest applications (time, then id): every concurrent caller computes the same winners
    let over = false;
    if (fresh.maxApplications) {
        const winners = await CampusApplication.find({ internshipId: fresh._id, status: { $ne: "withdrawn" } }).sort({ appliedAt: 1, _id: 1 }).limit(fresh.maxApplications).select("_id").lean();
        over = !winners.some((w) => w._id.equals(appId));
    }
    if (!stillThere?.entityId?.equals(enrollment.entityId) || over) {
        await undo(appId, !!existing);
        return stillThere?.entityId?.equals(enrollment.entityId) ? fail(409, "This internship has reached its maximum number of applications.", "full") : fail(409, "You left this campus. Your application was not sent.", "not_joined");
    }

    await notifyCollege({
        entityId: enrollment.entityId, type: "campus_new_applicant", title: `New application: ${fresh.company.name}`,
        body: `${snapshot.name} (${snapshot.uid}) applied for ${fresh.designation}.`,
        link: `/employer/campus/${String(enrollment.entityId)}/internships/${String(fresh._id)}/applicants`,
        actor: { kind: "student", id: enrollment.userId, name: snapshot.name },
    });
    return { ok: true, applicationId: String(appId) };
}

/** Takes back an application that lost a race: a new one is deleted, a re-application goes back to withdrawn. */
async function undo(appId: mongoose.Types.ObjectId, wasWithdrawn: boolean) {
    if (wasWithdrawn) await CampusApplication.updateOne({ _id: appId }, { $set: { status: "withdrawn" }, $push: { statusHistory: { status: "withdrawn", changedAt: new Date(), byStudent: true, note: "Could not be completed" } } });
    else await CampusApplication.deleteOne({ _id: appId, status: "applied" });
}
