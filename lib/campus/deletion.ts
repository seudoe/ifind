import { entityClosedMessage } from "./messages";
import { notifyStudents } from "./notify";
import { resolveStudentRecipients, sendToStudents } from "./outbound";
import CampusApplication from "@/models/CampusApplication";
import CampusEnrollment from "@/models/CampusEnrollment";
import CampusEntity, { type ICampusEntity } from "@/models/CampusEntity";
import CampusInternship from "@/models/CampusInternship";
import { CAMPUS_ACTIVE_STATUSES } from "@/types/campus";

export interface CloseResult {
    closed: boolean;
    students: number;
    withdrawn: number;
}

/**
 * Takes a campus out of service so nobody is stuck (4.8, 7): internships close, every active application becomes
 * `withdrawn` with a history note, joined students are detached (their yellow banner returns) and told, in-app and
 * through the outbound channel. Applications stay on record read-only. Idempotent: the first caller wins.
 * Used by owner deletion now and by moderator ban/restriction later.
 */
export async function closeCampusEntity(entity: Pick<ICampusEntity, "_id" | "name">, why: "deleted" | "banned" = "deleted"): Promise<CloseResult> {
    // Recipients must be resolved while students still point at the entity
    const [recipients, enrolled] = await Promise.all([
        resolveStudentRecipients(String(entity._id)),
        CampusEnrollment.find({ entityId: entity._id }).select("userId").lean(),
    ]);

    const now = new Date();
    const claimed = await CampusEntity.updateOne(
        { _id: entity._id, isActive: true },
        { $set: { isActive: false, "deleteDetails.deleted": why === "deleted", "deleteDetails.deletedAt": why === "deleted" ? now : null, studentCount: 0 } },
    );
    if (claimed.modifiedCount !== 1) return { closed: false, students: 0, withdrawn: 0 };

    await CampusInternship.updateMany({ entityId: entity._id, status: { $in: ["draft", "open"] } }, { $set: { status: "closed", closedAt: now } });
    const withdrawn = await CampusApplication.updateMany(
        { entityId: entity._id, status: { $in: CAMPUS_ACTIVE_STATUSES } },
        { $set: { status: "withdrawn" }, $push: { statusHistory: { status: "withdrawn", changedAt: now, note: `Campus ${why === "deleted" ? "was deleted" : "was closed by iFind"}` } } },
    );
    await CampusEnrollment.updateMany({ entityId: entity._id }, { $set: { entityId: null, joinedAt: null } });

    const title = `${entity.name} is no longer available`;
    await notifyStudents(enrolled.map((e) => e.userId), {
        type: "campus_entity_closed",
        title,
        body: "Your applications there were withdrawn. You can join another campus from College details.",
        path: "/campus",
    });
    await sendToStudents(
        recipients,
        (r) => entityClosedMessage({ entityName: entity.name, link: r.username ? `/user/${r.username}/campus` : "/" }),
        { email: true, kind: "entity-closed", refId: String(entity._id), defer: true },
    );
    return { closed: true, students: enrolled.length, withdrawn: withdrawn.modifiedCount };
}
