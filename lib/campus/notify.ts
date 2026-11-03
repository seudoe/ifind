import type mongoose from "mongoose";
import { StudentNotification } from "@/models/Notification";
import User from "@/models/User";
import { DEFAULT_PRIORITY, type NotificationPriority } from "@/lib/email/priority";
import CollegeNotification, { type ICollegeNotification } from "@/models/CollegeNotification";
import type { NotificationType } from "@/types/employer";

interface CollegeNotifyInput {
    entityId: string | mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    actor?: ICollegeNotification["actor"];
    priority?: NotificationPriority;
}

/**
 * One notification for the whole campus staff (notifications.college), in-app only. Email to staff goes through
 * lib/campus/outbound.ts (sendToStaff) when a message is warranted. Never throws.
 */
export async function notifyCollege({ priority, ...input }: CollegeNotifyInput): Promise<void> {
    try {
        await CollegeNotification.create({ ...input, priority: priority ?? DEFAULT_PRIORITY[input.type] ?? "normal" });
    } catch (err) {
        console.error("[notifyCollege]", err);
    }
}

/** In-app notification for students, one per student with a link built from their username. Never throws. */
export async function notifyStudents(
    studentIds: (string | mongoose.Types.ObjectId)[],
    n: { type: NotificationType; title: string; body?: string; path?: string; priority?: NotificationPriority },
): Promise<void> {
    if (!studentIds.length) return;
    try {
        const users = await User.find({ _id: { $in: studentIds } }).select("username").lean();
        await StudentNotification.insertMany(
            users.map((u) => ({
                recipientType: "student" as const,
                recipientId: u._id,
                type: n.type,
                title: n.title,
                body: n.body,
                link: n.path ? `/user/${u.username}${n.path}` : undefined,
                priority: n.priority ?? DEFAULT_PRIORITY[n.type] ?? "normal",
            })),
            { ordered: false },
        );
    } catch (err) {
        console.error("[notifyStudents]", err);
    }
}
