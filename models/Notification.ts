import mongoose, { type Document, type Model, Schema } from "mongoose";
import { NOTIFICATION_PRIORITIES, type NotificationPriority } from "@/lib/email/priority";
import { NOTIFICATION_TYPES, RECIPIENT_TYPES, type NotificationType, type RecipientType } from "@/types/employer";

export interface INotification extends Document {
    recipientType: RecipientType;
    recipientId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    companyId?: mongoose.Types.ObjectId | null;
    /** critical = also emailed; normal = inbox only (see lib/email/priority.ts). */
    priority: NotificationPriority;
    /** When the email for a critical notification was accepted by Brevo; null if not sent. */
    emailedAt?: Date | null;
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
            priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: "normal" },
            emailedAt: { type: Date, default: null },
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

/**
 * Company-wide events (a new applicant, a moderation verdict, a teammate publishing...). ONE document per event, stored
 * in "notifications.company" and shown to every current member of the company, instead of one copy per member.
 * Read state is per member (`readBy`), so one person reading it does not clear it for the rest of the team.
 * Personal things (you were added somewhere, your password changed) stay in "notifications.employer".
 */
export interface ICompanyNotification extends Document {
    companyId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    priority: NotificationPriority;
    emailedAt?: Date | null;
    /** Who triggered it, when it was a person (employer teammate / moderator). */
    actor?: { kind: "employer" | "moderator" | "student" | "system"; id?: mongoose.Types.ObjectId | null; name?: string | null } | null;
    readBy: { employerId: mongoose.Types.ObjectId; at: Date }[];
    createdAt: Date;
    updatedAt: Date;
}

export const COMPANY_NOTIFICATION_COLLECTION = "notifications.company";

const CompanyNotificationSchema = new Schema<ICompanyNotification>(
    {
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        type: { type: String, enum: NOTIFICATION_TYPES, required: true },
        title: { type: String, required: true, trim: true },
        body: { type: String, default: null },
        link: { type: String, default: null },
        priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: "normal" },
        emailedAt: { type: Date, default: null },
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
CompanyNotificationSchema.index({ companyId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CompanyNotification) delete mongoose.models.CompanyNotification;

export const CompanyNotification: Model<ICompanyNotification> =
    mongoose.models.CompanyNotification ||
    mongoose.model<ICompanyNotification>("CompanyNotification", CompanyNotificationSchema, COMPANY_NOTIFICATION_COLLECTION);

export default EmployerNotification;
