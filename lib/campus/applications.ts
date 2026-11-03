import mongoose from "mongoose";
import { ACCEPTED_WITHDRAW_WARNING } from "./copy";
import { notifyCollege } from "./notify";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";
import User from "@/models/User";
import { CAMPUS_ACTIVE_STATUSES, CAMPUS_STUDENT_TRANSITIONS, type CampusApplicationStatus } from "@/types/campus";

export type WithdrawResult =
    | { ok: true; status: CampusApplicationStatus }
    | { ok: false; status: number; error: string; code?: string };

/**
 * A student withdraws their own application, from any active status. An already accepted offer needs the extra
 * confirmation and tells the staff. The update is conditional, so a staff change at the same moment is never overwritten.
 */
export async function withdrawCampusApplication(userId: string, applicationId: string, confirmAccepted: boolean): Promise<WithdrawResult> {
    if (!mongoose.isValidObjectId(applicationId)) return { ok: false, status: 404, error: "Application not found" };
    const app = await CampusApplication.findOne({ _id: applicationId, studentId: userId });
    if (!app) return { ok: false, status: 404, error: "Application not found" };
    if (!CAMPUS_ACTIVE_STATUSES.includes(app.status)) return { ok: false, status: 409, error: `This application is already ${app.status}.`, code: "already_final" };
    if (!CAMPUS_STUDENT_TRANSITIONS[app.status].includes("withdrawn")) return { ok: false, status: 409, error: "This application can't be withdrawn." };
    if (app.status === "accepted" && !confirmAccepted) return { ok: false, status: 400, error: ACCEPTED_WITHDRAW_WARNING, code: "confirm_accepted" };

    const res = await CampusApplication.updateOne(
        { _id: app._id, studentId: app.studentId, status: app.status },
        { $set: { status: "withdrawn" }, $push: { statusHistory: { status: "withdrawn", byStudent: true, changedAt: new Date(), note: app.status === "accepted" ? "Withdrew an accepted offer" : null } } },
    );
    if (res.modifiedCount !== 1) return { ok: false, status: 409, error: "This application just changed. Reload and try again.", code: "conflict" };

    const [u, internship] = await Promise.all([User.findById(userId).select("name").lean(), CampusInternship.findById(app.internshipId).select("company.name designation").lean()]);
    await notifyCollege({
        entityId: app.entityId, type: "campus_withdrawal",
        title: `${u?.name ?? "A student"} withdrew${app.status === "accepted" ? " an accepted offer" : ""}`,
        body: internship ? `${internship.company.name} · ${internship.designation}` : undefined,
        link: `/employer/campus/${String(app.entityId)}/internships/${String(app.internshipId)}/details`,
        actor: { kind: "student", id: app.studentId, name: u?.name ?? null },
    });
    return { ok: true, status: "withdrawn" };
}
