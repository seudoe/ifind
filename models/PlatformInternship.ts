import crypto from "crypto";
import mongoose, { type Model, Schema } from "mongoose";
import { listingFields, type IInternship } from "@/models/Internship";
import {
    INTERNSHIP_STATUSES, QUESTION_TYPES, WORK_MODES,
    type InternshipStatus, type QuestionType, type WorkMode,
} from "@/types/employer";

export interface IScreeningQuestion {
    _id: mongoose.Types.ObjectId;
    question: string;
    type: QuestionType;
    options: string[];
    required: boolean;
}

export interface IPlatformInternship
    extends Omit<IInternship, "applyLink" | "datePublished" | "stipend" | "duration" | "source" | "tfidf_vector" | "bert_vector"> {
    source: "ifind";
    /** Written in place by the vectorizer once approved; never returned to clients. */
    tfidf_vector?: number[] | null;
    bert_vector?: number[] | null;
    vectorizedAt?: Date | null;
    // Optional while a draft; the publish step requires them
    stipend?: IInternship["stipend"];
    duration?: IInternship["duration"];
    applyLink: string | null;
    datePublished?: Date | null;
    companyId: mongoose.Types.ObjectId;
    postedBy: mongoose.Types.ObjectId;
    status: InternshipStatus;
    workMode: WorkMode;
    startDate?: Date | null;
    hoursPerWeek?: number | null;
    ppoAvailable: boolean;
    certificate: boolean;
    whoCanApply?: string | null;
    screeningQuestions: IScreeningQuestion[];
    requireResume: boolean;
    requireCoverLetter: boolean;
    maxApplications?: number | null;
    closedAt?: Date | null;
}

const ScreeningQuestionSchema = new Schema<IScreeningQuestion>({
    question: { type: String, required: true, trim: true, maxlength: 300 },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
});

/** Same formula as internScraper/pipeline.py:generate_fingerprint. */
export function platformFingerprint(company: string, name: string, city?: string | null): string {
    const raw = `${company.toLowerCase().trim()}:${name.toLowerCase().trim()}:${(city || "remote").toLowerCase().trim()}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
}

export const PLATFORM_COLLECTION = "internships.this-platform";

const PlatformInternshipSchema = new Schema<IPlatformInternship>(
    {
        ...listingFields,
        applyLink: { type: String, default: null, trim: true },
        datePublished: { type: Date, default: null },
        // Drafts may be saved with only a title; completeness is enforced at publish time
        stipend: { ...listingFields.stipend, required: false },
        duration: { ...listingFields.duration, required: false },
        summary: { type: String, default: "" },
        source: { type: String, enum: ["ifind"], default: "ifind" },
        tfidf_vector: { type: Schema.Types.Mixed, default: null, select: false },
        bert_vector: { type: Schema.Types.Mixed, default: null, select: false },
        vectorizedAt: { type: Date, default: null },
        companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
        postedBy: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        status: { type: String, enum: INTERNSHIP_STATUSES, default: "draft" },
        workMode: { type: String, enum: WORK_MODES, default: "onsite" },
        startDate: { type: Date, default: null },
        hoursPerWeek: { type: Number, default: null },
        ppoAvailable: { type: Boolean, default: false },
        certificate: { type: Boolean, default: false },
        whoCanApply: { type: String, default: null },
        screeningQuestions: {
            type: [ScreeningQuestionSchema],
            default: [],
            validate: [(v: unknown[]) => v.length <= 10, "At most 10 screening questions"],
        },
        requireResume: { type: Boolean, default: true },
        requireCoverLetter: { type: Boolean, default: false },
        maxApplications: { type: Number, default: null },
        closedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

PlatformInternshipSchema.index({ companyId: 1, status: 1, createdAt: -1 });
PlatformInternshipSchema.index({ status: 1, "moderation.status": 1, deadlineDate: 1 });
// non-unique on purpose: reposts are allowed
PlatformInternshipSchema.index({ fingerprint: 1 }, { sparse: true });

PlatformInternshipSchema.pre("validate", function () {
    this.isRemote = this.workMode === "remote";
    this.source = "ifind";
    this.moderation.source = "employer";
    if (this.name && this.company) this.fingerprint = platformFingerprint(this.company, this.name, this.city);
});

if (process.env.NODE_ENV !== "production" && mongoose.models.PlatformInternship) {
    delete mongoose.models.PlatformInternship;
}

const PlatformInternship: Model<IPlatformInternship> =
    mongoose.models.PlatformInternship ||
    mongoose.model<IPlatformInternship>("PlatformInternship", PlatformInternshipSchema, PLATFORM_COLLECTION);

export default PlatformInternship;
