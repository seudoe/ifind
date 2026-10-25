import type mongoose from "mongoose";
import Moderator from "@/models/Moderator";
import { CompanyNotification, notificationModel, type ICompanyNotification } from "@/models/Notification";
import type { NotificationType, RecipientType } from "@/types/employer";

interface NotifyInput {
    recipientType: RecipientType;
    recipientIds: (string | mongoose.Types.ObjectId)[];
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    companyId?: string | mongoose.Types.ObjectId;
}

/** One notification per recipient. Never throws: a failed notification must not fail the action that triggered it. */
export async function notify({ recipientIds, ...rest }: NotifyInput): Promise<void> {
    if (!recipientIds.length) return;
    try {
        await notificationModel(rest.recipientType).insertMany([...new Set(recipientIds.map(String))].map((id) => ({ ...rest, recipientId: id })));
    } catch (err) {
        console.error("[notify]", err);
    }
}

interface CompanyNotifyInput {
    companyId: string | mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    actor?: ICompanyNotification["actor"];
}

/**
 * One notification for the whole company (notifications.company), visible to every member. Use this for anything the
 * team should see; use notify() with recipientType "employer" for things meant for one person only.
 */
export async function notifyCompany(input: CompanyNotifyInput): Promise<void> {
    try {
        await CompanyNotification.create(input);
    } catch (err) {
        console.error("[notifyCompany]", err);
    }
}

/** Every verified, active moderator: the audience for review-queue events. */
export async function moderatorIds(): Promise<mongoose.Types.ObjectId[]> {
    const mods = await Moderator.find({ isVerified: true, isBanned: { $ne: true } }).select("_id").lean();
    return mods.map((m) => m._id as mongoose.Types.ObjectId);
}
