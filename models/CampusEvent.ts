import mongoose, { type Document, type Model, Schema } from "mongoose";
import { CAMPUS_EVENT_MODES, CAMPUS_EVENT_STATUSES, CAMPUS_EVENT_TYPES, isEventAudience, type CampusEventType } from "@/types/campus";

export interface ICampusEvent extends Document {
    entityId: mongoose.Types.ObjectId;
    /** Null = campus-wide. */
    internshipId?: mongoose.Types.ObjectId | null;
    createdBy: mongoose.Types.ObjectId;
    type: CampusEventType;
    title: string;
    body: string;
    startsAt?: Date | null;
    endsAt?: Date | null;
    deadlineAt?: Date | null;
    mode: (typeof CAMPUS_EVENT_MODES)[number];
    venue?: string | null;
    link?: string | null;
    attachments: { name: string; url: string }[];
    audience: string;
    notify: { email: boolean; sms: boolean };
    /** Bumped on every update that re-notifies; part of the outbound idempotency key. */
    version: number;
    notifiedAt?: Date | null;
    status: (typeof CAMPUS_EVENT_STATUSES)[number];
    createdAt: Date;
    updatedAt: Date;
}

const CampusEventSchema = new Schema<ICampusEvent>(
    {
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", required: true },
        internshipId: { type: Schema.Types.ObjectId, ref: "CampusInternship", default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        type: { type: String, enum: CAMPUS_EVENT_TYPES, default: "announcement" },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        body: { type: String, default: "", maxlength: 10000 },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
        deadlineAt: { type: Date, default: null },
        mode: { type: String, enum: CAMPUS_EVENT_MODES, default: "online" },
        venue: { type: String, default: null, trim: true, maxlength: 300 },
        link: { type: String, default: null, trim: true },
        attachments: { type: [new Schema({ name: { type: String, required: true }, url: { type: String, required: true } }, { _id: false })], default: [] },
        audience: { type: String, default: "all_members", validate: [isEventAudience, "Invalid audience"] },
        notify: {
            type: new Schema({ email: { type: Boolean, default: true }, sms: { type: Boolean, default: false } }, { _id: false }),
            default: () => ({ email: true, sms: false }),
        },
        version: { type: Number, default: 1 },
        notifiedAt: { type: Date, default: null },
        status: { type: String, enum: CAMPUS_EVENT_STATUSES, default: "scheduled" },
    },
    { timestamps: true, collection: "campus-internships.events" },
);

CampusEventSchema.index({ entityId: 1, startsAt: 1 });
CampusEventSchema.index({ internshipId: 1, startsAt: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusEvent) delete mongoose.models.CampusEvent;

const CampusEvent: Model<ICampusEvent> = mongoose.models.CampusEvent || mongoose.model<ICampusEvent>("CampusEvent", CampusEventSchema);
export default CampusEvent;
