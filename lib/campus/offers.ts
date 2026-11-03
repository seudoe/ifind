import mongoose from "mongoose";
import { notifyCollege } from "./notify";
import type { Outcome } from "./student";
import CampusApplication from "@/models/CampusApplication";
import CampusEntity from "@/models/CampusEntity";
import CampusInternship from "@/models/CampusInternship";
import User from "@/models/User";
import { CAMPUS_ACTIVE_STATUSES } from "@/types/campus";

const no = (status: number, error: string, code?: string): Outcome<never> => ({ ok: false, status, error, code });

/**
 * The student answers an offer. Rules:
 *  - only an `offered` application can be accepted or declined, by its own student;
 *  - after the entity's accept window (`offer.acceptBy`) the offer has lapsed and staff must be asked;
 *  - with policy.oneStudentOneOffer, a student who already accepted another offer here cannot accept a second one,
 *    and accepting withdraws their other open applications in this campus (history says why).
 * Updates are conditional so a staff change at the same moment is never overwritten.
 */
export async function respondToOffer(userId: string, applicationId: string, decision: "accept" | "decline"): Promise<Outcome<{ status: "accepted" | "declined"; withdrawnOthers: number }>> {
    if (!mongoose.isValidObjectId(applicationId)) return no(404, "Application not found", "not_found");
    const app = await CampusApplication.findOne({ _id: applicationId, studentId: userId });
    if (!app) return no(404, "Application not found", "not_found");
    if (app.status !== "offered") return no(409, "There is no open offer on this application.", "not_offered");
    if (app.offer?.acceptBy && app.offer.acceptBy < new Date()) return no(409, "This offer has lapsed. Contact the placement team.", "offer_expired");

    const entity = await CampusEntity.findById(app.entityId).select("name policy isActive").lean();
    if (!entity?.isActive) return no(409, "This campus is no longer available.", "gone");
    const oneOffer = !!entity.policy?.oneStudentOneOffer;

    if (decision === "accept" && oneOffer && (await CampusApplication.exists({ entityId: app.entityId, studentId: app.studentId, status: "accepted", _id: { $ne: app._id } }))) {
        return no(409, "Your campus allows one offer per student, and you have already accepted another.", "one_offer");
    }

    const to = decision === "accept" ? "accepted" : "declined";
    const now = new Date();
    const res = await CampusApplication.updateOne(
        { _id: app._id, studentId: app.studentId, status: "offered" },
        { $set: { status: to, "offer.respondedAt": now }, $push: { statusHistory: { status: to, changedAt: now, byStudent: true } } },
    );
    if (res.modifiedCount !== 1) return no(409, "This application just changed. Reload and try again.", "conflict");

    let withdrawnOthers = 0;
    if (decision === "accept" && oneOffer) {
        const r = await CampusApplication.updateMany(
            { entityId: app.entityId, studentId: app.studentId, _id: { $ne: app._id }, status: { $in: CAMPUS_ACTIVE_STATUSES.filter((s) => s !== "accepted") } },
            { $set: { status: "withdrawn" }, $push: { statusHistory: { status: "withdrawn", byStudent: true, changedAt: now, note: "Withdrawn automatically: one offer per student" } } },
        );
        withdrawnOthers = r.modifiedCount;
    }

    const [u, internship] = await Promise.all([User.findById(userId).select("name").lean(), CampusInternship.findById(app.internshipId).select("company.name designation").lean()]);
    await notifyCollege({
        entityId: app.entityId, type: "campus_offer_response", title: `${u?.name ?? "A student"} ${to} the offer`,
        body: internship ? `${internship.company.name} · ${internship.designation}${withdrawnOthers ? ` · ${withdrawnOthers} other application(s) withdrawn` : ""}` : undefined,
        link: `/employer/campus/${String(app.entityId)}/internships/${String(app.internshipId)}/applicants`,
        actor: { kind: "student", id: app.studentId, name: u?.name ?? null },
    });
    return { ok: true, status: to, withdrawnOthers };
}
