import mongoose, { type Document, type Model, Schema } from "mongoose";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/types/employer";

export interface IApplication extends Document {
    internshipId: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    status: ApplicationStatus;
    statusHistory: { status: ApplicationStatus; changedBy?: mongoose.Types.ObjectId | null; changedAt: Date; note?: string | null }[];
    resumeSnapshot: { url?: string | null; parsedData?: unknown; skills: string[] };
    coverLetter?: string | null;
    answers: { questionId: mongoose.Types.ObjectId; answer: unknown }[];
    matchScore?: number | null;
    rating?: number | null;
    notes: { _id: mongoose.Types.ObjectId; authorId: mongoose.Types.ObjectId; text: string; createdAt: Date }[];
    appliedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
    {
        internshipId: { type: Schema.Types.ObjectId, ref: "PlatformInternship", required: true },
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
        studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: APPLICATION_STATUSES, default: "applied" },
        statusHistory: {
            type: [
                new Schema(
                    {
                        status: { type: String, enum: APPLICATION_STATUSES, required: true },
                        changedBy: { type: Schema.Types.ObjectId, ref: "Employer", default: null },
                        changedAt: { type: Date, default: Date.now },
                        note: { type: String, default: null },
                    },
                    { _id: false },
                ),
            ],
            default: [],
        },
        resumeSnapshot: {
            type: new Schema(
                {
                    url: { type: String, default: null },
                    parsedData: { type: Schema.Types.Mixed, default: null },
                    skills: { type: [String], default: [] },
                },
                { _id: false },
            ),
            default: () => ({ skills: [] }),
        },
        coverLetter: { type: String, default: null, maxlength: 5000 },
        answers: {
            type: [
                new Schema(
                    {
                        questionId: { type: Schema.Types.ObjectId, required: true },
                        answer: { type: Schema.Types.Mixed, default: null },
                    },
                    { _id: false },
                ),
            ],
            default: [],
        },
        matchScore: { type: Number, min: 0, max: 1, default: null },
        rating: { type: Number, min: 1, max: 5, default: null },
        notes: {
            type: [
                new Schema({
                    authorId: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
                    text: { type: String, required: true, maxlength: 2000 },
                    createdAt: { type: Date, default: Date.now },
                }),
            ],
            default: [],
        },
        appliedAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
);

ApplicationSchema.index({ internshipId: 1, studentId: 1 }, { unique: true });
ApplicationSchema.index({ companyId: 1, status: 1 });
ApplicationSchema.index({ studentId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.Application) {
    delete mongoose.models.Application;
}

const Application: Model<IApplication> =
    mongoose.models.Application || mongoose.model<IApplication>("Application", ApplicationSchema, "applications");

export default Application;
