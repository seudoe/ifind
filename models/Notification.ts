import mongoose, { type Document, type Model, Schema } from "mongoose";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES, type NotificationType, type RecipientType } from "@/types/employer";

export interface INotification extends Document {
    recipientType: RecipientType;
    recipientId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    companyId?: mongoose.Types.ObjectId | null;
    readAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** One collection per audience, so each side reads only its own. */
export const NOTIFICATION_COLLECTIONS: Record<RecipientType, string> = {
    student: "notifications.student",
    employer: "notifications.employer",
    moderator: "notifications.moderator",
};

function makeSchema() {
    const schema = new Schema<INotification>(
        {
            recipientType: { type: String, enum: RECIPIENT_TYPES, required: true },
            recipientId: { type: Schema.Types.ObjectId, required: true },
            type: { type: String, enum: NOTIFICATION_TYPES, required: true },
            title: { type: String, required: true, trim: true },
            body: { type: String, default: null },
            link: { type: String, default: null },
            companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null },
            readAt: { type: Date, default: null },
        },
        { timestamps: true },
    );
    schema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
    return schema;
}

function build(type: RecipientType): Model<INotification> {
    const name = `Notification_${type}`;
    if (process.env.NODE_ENV !== "production" && mongoose.models[name]) delete mongoose.models[name];
    return mongoose.models[name] || mongoose.model<INotification>(name, makeSchema(), NOTIFICATION_COLLECTIONS[type]);
}

export const StudentNotification = build("student");
export const EmployerNotification = build("employer");
export const ModeratorNotification = build("moderator");

const MODELS: Record<RecipientType, Model<INotification>> = {
    student: StudentNotification,
    employer: EmployerNotification,
    moderator: ModeratorNotification,
};

/** Model for a recipient type (e.g. the student side later: notificationModel("student")). */
export function notificationModel(type: RecipientType): Model<INotification> {
    return MODELS[type];
}

export default EmployerNotification;
