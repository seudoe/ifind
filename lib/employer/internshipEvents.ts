import type mongoose from "mongoose";
import { moderatorIds, notify, notifyCompany } from "@/lib/employer/notify";
import Application from "@/models/Application";
import User from "@/models/User";
import type { IPlatformInternship } from "@/models/PlatformInternship";
import type { ApplicationStatus } from "@/types/employer";

type Doc = Pick<IPlatformInternship, "name" | "company" | "companyId" | "moderation"> & { _id: mongoose.Types.ObjectId | string };

const base = (d: Doc) => `/employer/company/${d.companyId}/internships/${d._id}/overview`;

/**
 * After a first publish: tell the team what the automated checks decided, and (when a human has to look) every
 * moderator. `actorName` is the teammate who pressed Publish.
 */
export async function notifyPublishOutcome(d: Doc, actorName: string, actorId: mongoose.Types.ObjectId) {
    const status = d.moderation.status;
    const actor = { kind: "employer" as const, id: actorId, name: actorName };

    if (status === "auto_approved") {
        await notifyCompany({ companyId: d.companyId, type: "internship_approved", title: `"${d.name}" is live`, body: "It passed the automated checks and is visible to students.", link: base(d), actor });
    } else if (status === "auto_rejected") {
        await notifyCompany({ companyId: d.companyId, type: "internship_rejected", title: `"${d.name}" was rejected by the automated checks`, body: d.moderation.rejectionReason ?? "It looked like a scam or was missing information. Edit it and publish again.", link: base(d), actor });
    } else {
        await notifyCompany({ companyId: d.companyId, type: "internship_pending_review", title: `"${d.name}" is waiting for review`, body: "A moderator will look at it shortly. You will be told the outcome.", link: base(d), actor });
        await notify({
            recipientType: "moderator",
            recipientIds: await moderatorIds(),
            type: "internship_pending_review",
            title: `New listing to review: "${d.name}"`,
            body: `${d.company}${d.moderation.score != null ? ` · scam score ${d.moderation.score}` : ""}`,
            link: `/moderator/me/analyze?kind=employer&id=${d._id}`,
        });
    }
}

const ACTION_LABEL: Record<string, string> = { pause: "paused", close: "closed", archive: "archived" };

/** A teammate paused / closed / archived a listing. Closing or archiving also tells the students who already applied. */
export async function notifyStatusChange(d: Doc, action: string, actorName: string, actorId: mongoose.Types.ObjectId) {
    const label = ACTION_LABEL[action];
    if (!label) return;
    await notifyCompany({
        companyId: d.companyId,
        type: "internship_status",
        title: `"${d.name}" was ${label}`,
        body: `By ${actorName}.`,
        link: base(d),
        actor: { kind: "employer", id: actorId, name: actorName },
    });
    if (action === "close" || action === "archive") await notifyApplicantsClosed(d, "The employer stopped accepting applications.");
}

const OPEN_STATUSES: ApplicationStatus[] = ["applied", "under_review", "shortlisted", "interview", "offered"];

/** Students with a still-open application hear that the listing closed, so they are not left waiting. */
export async function notifyApplicantsClosed(d: Pick<Doc, "_id" | "name" | "company" | "companyId">, reason: string) {
    const apps = await Application.find({ internshipId: d._id, status: { $in: OPEN_STATUSES } }).select("studentId").lean();
    if (!apps.length) return;
    const users = await User.find({ _id: { $in: apps.map((a) => a.studentId) } }).select("username").lean();
    for (const u of users) {
        await notify({
            recipientType: "student",
            recipientIds: [u._id],
            type: "internship_closed",
            title: `${d.name} is no longer open`,
            body: `${d.company}: ${reason} Your application stays on record.`,
            link: `/user/${u.username}/applied-internships/${d._id}`,
            companyId: d.companyId,
        });
    }
}
