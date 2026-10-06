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

const NotificationSchema = new Schema<INotification>(
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

NotificationSchema.index({ recipientType: 1, recipientId: 1, readAt: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.Notification) {
    delete mongoose.models.Notification;
}

const Notification: Model<INotification> =
    mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema, "notifications");

export default Notification;
