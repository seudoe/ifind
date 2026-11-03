import mongoose, { type Document, type Model, Schema } from "mongoose";
import { NOTIFICATION_PRIORITIES, type NotificationPriority } from "@/lib/email/priority";
import { NOTIFICATION_TYPES, type NotificationType } from "@/types/employer";

/** Staff-side shared inbox of a campus entity (twin of CompanyNotification). One document per event; read state per member. */
export interface ICollegeNotification extends Document {
    entityId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    priority: NotificationPriority;
    actor?: { kind: "employer" | "moderator" | "student" | "system"; id?: mongoose.Types.ObjectId | null; name?: string | null } | null;
    readBy: { employerId: mongoose.Types.ObjectId; at: Date }[];
    createdAt: Date;
    updatedAt: Date;
}

export const COLLEGE_NOTIFICATION_COLLECTION = "notifications.college";

const CollegeNotificationSchema = new Schema<ICollegeNotification>(
    {
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", required: true },
        type: { type: String, enum: NOTIFICATION_TYPES, required: true },
        title: { type: String, required: true, trim: true },
        body: { type: String, default: null },
        link: { type: String, default: null },
        priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: "normal" },
        actor: {
            type: new Schema(
                {
                    kind: { type: String, enum: ["employer", "moderator", "student", "system"], required: true },
                    id: { type: Schema.Types.ObjectId, default: null },
                    name: { type: String, default: null },
                },
                { _id: false },
            ),
            default: null,
        },
        readBy: {
            type: [new Schema({ employerId: { type: Schema.Types.ObjectId, required: true }, at: { type: Date, default: Date.now } }, { _id: false })],
            default: [],
        },
    },
    { timestamps: true },
);
CollegeNotificationSchema.index({ entityId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CollegeNotification) delete mongoose.models.CollegeNotification;

const CollegeNotification: Model<ICollegeNotification> =
    mongoose.models.CollegeNotification ||
    mongoose.model<ICollegeNotification>("CollegeNotification", CollegeNotificationSchema, COLLEGE_NOTIFICATION_COLLECTION);
export default CollegeNotification;
