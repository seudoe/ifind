import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface ICampusEnrollment extends Document {
    userId: mongoose.Types.ObjectId;
    collegeId: mongoose.Types.ObjectId;
    /** Null until the student joins an entity (and again after leaving). */
    entityId: mongoose.Types.ObjectId | null;
    course: string;
    department: string;
    /** Self-declared and NOT unique: a fake claim must not block the real student. Staff see a duplicate badge. */
    collegeUid: string;
    batch: number;
    currentYear?: number | null;
    cgpa?: number | null;
    activeBacklogs?: number | null;
    phone?: string | null;
    collegeEmail?: string | null;
    section?: string | null;
    emailUpdates: boolean;
    /** Only honoured when `phone` is set. SMS is a stub today. */
    smsUpdates: boolean;
    joinedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const CampusEnrollmentSchema = new Schema<ICampusEnrollment>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true },
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", default: null },
        course: { type: String, required: true, trim: true, maxlength: 120 },
        department: { type: String, required: true, trim: true, maxlength: 120 },
        collegeUid: { type: String, required: true, trim: true, maxlength: 60 },
        batch: { type: Number, required: true, min: 2000, max: 2100 },
        currentYear: { type: Number, default: null, min: 1, max: 8 },
        cgpa: { type: Number, default: null, min: 0, max: 100 },
        activeBacklogs: { type: Number, default: null, min: 0, max: 100 },
        phone: { type: String, default: null, trim: true },
        collegeEmail: { type: String, default: null, trim: true, lowercase: true },
        section: { type: String, default: null, trim: true, maxlength: 20 },
        emailUpdates: { type: Boolean, default: true },
        smsUpdates: { type: Boolean, default: false },
        joinedAt: { type: Date, default: null },
    },
    { timestamps: true, collection: "colleges.students" },
);

// userId unique comes from the field. No approval/status field by design.
CampusEnrollmentSchema.index({ collegeId: 1 });
CampusEnrollmentSchema.index({ entityId: 1, batch: 1 });
CampusEnrollmentSchema.index({ entityId: 1, collegeUid: 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusEnrollment) delete mongoose.models.CampusEnrollment;

const CampusEnrollment: Model<ICampusEnrollment> =
    mongoose.models.CampusEnrollment || mongoose.model<ICampusEnrollment>("CampusEnrollment", CampusEnrollmentSchema);
export default CampusEnrollment;
