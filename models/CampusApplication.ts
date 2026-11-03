import mongoose, { type Document, type Model, Schema } from "mongoose";
import { CAMPUS_APPLICATION_STATUSES, CAMPUS_ROUND_RESULTS, type CampusApplicationStatus } from "@/types/campus";

export interface ICampusApplication extends Document {
    entityId: mongoose.Types.ObjectId;
    internshipId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    enrollmentId: mongoose.Types.ObjectId;
    status: CampusApplicationStatus;
    currentRound?: string | null;
    rounds: { name: string; result: (typeof CAMPUS_ROUND_RESULTS)[number]; at?: Date | null; note?: string | null }[];
    statusHistory: { status: CampusApplicationStatus; changedBy?: mongoose.Types.ObjectId | null; byStudent?: boolean; changedAt: Date; note?: string | null }[];
    /** Staff removed the student from this internship. Does NOT ban; blocks re-applying here until reinstated. */
    removal?: { by: mongoose.Types.ObjectId; at: Date; reason?: string | null } | null;
    resumeSnapshot: { url?: string | null; parsedData?: unknown; skills: string[] };
    applicantSnapshot: {
        name: string; uid: string; course: string; department: string; batch: number;
        cgpa?: number | null; activeBacklogs?: number | null; phone?: string | null; email: string;
    };
    coverLetter?: string | null;
    answers: { questionId: mongoose.Types.ObjectId; answer: unknown }[];
    /** Staff-only. Never sent to students. */
    notes: { _id: mongoose.Types.ObjectId; authorId: mongoose.Types.ObjectId; text: string; createdAt: Date }[];
    rating?: number | null;
    offer?: { acceptBy?: Date | null; respondedAt?: Date | null } | null;
    appliedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const CampusApplicationSchema = new Schema<ICampusApplication>(
    {
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", required: true },
        internshipId: { type: Schema.Types.ObjectId, ref: "CampusInternship", required: true },
        studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        enrollmentId: { type: Schema.Types.ObjectId, ref: "CampusEnrollment", required: true },
        status: { type: String, enum: CAMPUS_APPLICATION_STATUSES, default: "applied" },
        currentRound: { type: String, default: null },
        rounds: {
            type: [
                new Schema(
                    {
                        name: { type: String, required: true, trim: true, maxlength: 80 },
                        result: { type: String, enum: CAMPUS_ROUND_RESULTS, default: "pending" },
                        at: { type: Date, default: null },
                        note: { type: String, default: null, maxlength: 500 },
                    },
                    { _id: false },
                ),
            ],
            default: [],
        },
        statusHistory: {
            type: [
                new Schema(
                    {
                        status: { type: String, enum: CAMPUS_APPLICATION_STATUSES, required: true },
                        changedBy: { type: Schema.Types.ObjectId, ref: "Employer", default: null },
                        byStudent: { type: Boolean, default: false },
                        changedAt: { type: Date, default: Date.now },
                        note: { type: String, default: null },
                    },
                    { _id: false },
                ),
            ],
            default: [],
        },
        removal: {
            type: new Schema(
                {
                    by: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
                    at: { type: Date, default: Date.now },
                    reason: { type: String, default: null, maxlength: 500 },
                },
                { _id: false },
            ),
            default: null,
        },
        resumeSnapshot: {
            type: new Schema(
                { url: { type: String, default: null }, parsedData: { type: Schema.Types.Mixed, default: null }, skills: { type: [String], default: [] } },
                { _id: false },
            ),
            default: () => ({ skills: [] }),
        },
        applicantSnapshot: {
            type: new Schema(
                {
                    name: { type: String, required: true, trim: true, maxlength: 100 },
                    uid: { type: String, required: true, trim: true },
                    course: { type: String, required: true, trim: true },
                    department: { type: String, required: true, trim: true },
                    batch: { type: Number, required: true },
                    cgpa: { type: Number, default: null },
                    activeBacklogs: { type: Number, default: null },
                    phone: { type: String, default: null, trim: true },
                    email: { type: String, required: true, trim: true },
                },
                { _id: false },
            ),
            required: true,
        },
        coverLetter: { type: String, default: null, maxlength: 5000 },
        answers: {
            type: [new Schema({ questionId: { type: Schema.Types.ObjectId, required: true }, answer: { type: Schema.Types.Mixed, default: null } }, { _id: false })],
            default: [],
        },
        notes: {
            type: [
                new Schema(
                    {
                        authorId: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
                        text: { type: String, required: true, maxlength: 2000 },
                        createdAt: { type: Date, default: Date.now },
                    },
                ),
            ],
            default: [],
        },
        rating: { type: Number, default: null, min: 1, max: 5 },
        offer: {
            type: new Schema({ acceptBy: { type: Date, default: null }, respondedAt: { type: Date, default: null } }, { _id: false }),
            default: null,
        },
        appliedAt: { type: Date, default: Date.now },
    },
    { timestamps: true, collection: "campus-internships.applications" },
);

CampusApplicationSchema.index({ internshipId: 1, studentId: 1 }, { unique: true });
CampusApplicationSchema.index({ studentId: 1, status: 1 });
CampusApplicationSchema.index({ entityId: 1, status: 1, appliedAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusApplication) delete mongoose.models.CampusApplication;

const CampusApplication: Model<ICampusApplication> =
    mongoose.models.CampusApplication || mongoose.model<ICampusApplication>("CampusApplication", CampusApplicationSchema);
export default CampusApplication;
