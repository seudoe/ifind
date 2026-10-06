import type mongoose from "mongoose";
import Notification from "@/models/Notification";
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
        await Notification.insertMany([...new Set(recipientIds.map(String))].map((id) => ({ ...rest, recipientId: id })));
    } catch (err) {
        console.error("[notify]", err);
    }
}
