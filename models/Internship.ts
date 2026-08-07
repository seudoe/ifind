import mongoose, { type Document, type Model, Schema } from "mongoose";

interface IStipend {
    type: "paid" | "unpaid" | "performance-based";
    amount?: number | null;
    currency?: string | null;
    period?: "monthly" | "weekly" | "lump-sum" | null;
}

interface IDuration {
    value: number;
    unit: "weeks" | "months";
}

interface IExperienceRequired {
    min?: number | null;
    max?: number | null;
    unit: "months" | "years";
}

interface ILinkVerification {
    reachable: boolean | null;
    statusCode?: number | null;
    redirectedTo?: string | null;
    isScamSuspected: boolean | null;
    isExpired: boolean | null;
    scamSignals: string[];
    checkedAt?: Date | null;
    nextCheckAt?: Date | null;
}

interface IRiskBreakdown {
    textRisk?: number | null;
    companyRisk?: number | null;
    urlRisk?: number | null;
    stipendRisk?: number | null;
    anomalyScore?: number | null;
}

interface IScamDetails {
    score: number;
    decision: "clear" | "review" | "block";
    confidence: number;
    explanationSummary: string;
    scamFlags: string[];
    evaluatedAt?: Date | null;
    riskBreakdown?: IRiskBreakdown | null;
}

export interface IModeration {
    status:
        | "auto_approved"
        | "pending_review"
        | "auto_rejected"
        | "manually_approved"
        | "manually_rejected";
    score: number | null;
    flags: string[];
    source:
        | "web_scraping"
        | "api"
        | "user_contributed"
        | "email_parsing"
        | "rss"
        | "community_bot"
        | "manual";
    reviewedBy?: string | null;
    reviewedAt?: Date | null;
    rejectionReason?: string | null;
    scamDetails?: IScamDetails | null;
}

export interface IInternship extends Document {
    name: string;
    company: string;
    applyLink: string;
    datePublished: Date;
    deadlineDate?: Date | null;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    isRemote: boolean;
    stipend: IStipend;
    duration: IDuration;
    skills: string[];
    degree?: string[] | null;
    field?: string[] | null;
    experienceRequired?: IExperienceRequired | null;
    openings?: number | null;
    summary: string;
    responsibilities?: string[] | null;
    perks?: string[] | null;
    tags?: string[] | null;
    source?: string | null;
    isActive: boolean;
    fingerprint?: string | null;
    linkVerification?: ILinkVerification;
    moderation: IModeration;
    createdAt: Date;
    updatedAt: Date;
}

const StipendSchema = new Schema<IStipend>(
    {
        type: {
            type: String,
            enum: ["paid", "unpaid", "performance-based"],
            required: true,
        },
        amount: { type: Number, default: null },
        currency: { type: String, default: null },
        period: {
            type: String,
            enum: ["monthly", "weekly", "lump-sum", null],
            default: null,
        },
    },
    { _id: false },
);

const DurationSchema = new Schema<IDuration>(
    {
        value: { type: Number, required: true },
        unit: { type: String, enum: ["weeks", "months"], required: true },
    },
    { _id: false },
);

const ExperienceRequiredSchema = new Schema<IExperienceRequired>(
    {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        unit: { type: String, enum: ["months", "years"], required: true },
    },
    { _id: false },
);

const LinkVerificationSchema = new Schema<ILinkVerification>(
    {
        reachable: { type: Boolean, default: null },
        statusCode: { type: Number, default: null },
        redirectedTo: { type: String, default: null },
        isScamSuspected: { type: Boolean, default: null },
        isExpired: { type: Boolean, default: null },
        scamSignals: { type: [String], default: [] },
        checkedAt: { type: Date, default: null },
        nextCheckAt: { type: Date, default: null },
    },
    { _id: false },
);

const RiskBreakdownSchema = new Schema<IRiskBreakdown>(
    {
        textRisk: { type: Number, default: null },
        companyRisk: { type: Number, default: null },
        urlRisk: { type: Number, default: null },
        stipendRisk: { type: Number, default: null },
        anomalyScore: { type: Number, default: null },
    },
    { _id: false },
);

const ScamDetailsSchema = new Schema<IScamDetails>(
    {
        score: { type: Number, required: true },
        decision: {
            type: String,
            enum: ["clear", "review", "block"],
            required: true,
        },
        confidence: { type: Number, required: true },
        explanationSummary: { type: String, required: true },
        scamFlags: { type: [String], default: [] },
        evaluatedAt: { type: Date, default: null },
        riskBreakdown: { type: RiskBreakdownSchema, default: null },
    },
    { _id: false },
);

const ModerationSchema = new Schema<IModeration>(
    {
        status: {
            type: String,
            enum: [
                "auto_approved",
                "pending_review",
                "auto_rejected",
                "manually_approved",
                "manually_rejected",
            ],
            default: "pending_review",
        },
        score: { type: Number, default: null },
        flags: { type: [String], default: [] },
        source: {
            type: String,
            enum: [
                "web_scraping",
                "api",
                "user_contributed",
                "email_parsing",
                "rss",
                "community_bot",
                "manual",
            ],
            default: "manual",
        },
        reviewedBy: { type: String, default: null },
        reviewedAt: { type: Date, default: null },
        rejectionReason: { type: String, default: null },
        scamDetails: { type: ScamDetailsSchema, default: null },
    },
    { _id: false },
);

const InternshipSchema = new Schema<IInternship>(
    {
        name: { type: String, required: true, trim: true },
        company: { type: String, required: true, trim: true },
        applyLink: { type: String, required: true, trim: true },
        datePublished: { type: Date, required: true },
        deadlineDate: { type: Date, default: null },
        country: { type: String, default: null, trim: true },
        state: { type: String, default: null, trim: true },
        city: { type: String, default: null, trim: true },
        isRemote: { type: Boolean, default: false },
        stipend: { type: StipendSchema, required: true },
        duration: { type: DurationSchema, required: true },
        skills: { type: [String], default: [] },
        degree: { type: [String], default: null },
        field: { type: [String], default: null },
        experienceRequired: {
            type: ExperienceRequiredSchema,
            default: null,
        },
        openings: { type: Number, default: null },
        summary: { type: String, required: true },
        responsibilities: { type: [String], default: null },
        perks: { type: [String], default: null },
        tags: { type: [String], default: null },
        source: { type: String, default: null, trim: true },
        isActive: { type: Boolean, default: true },
        fingerprint: { type: String, default: null, trim: true },
        linkVerification: { type: LinkVerificationSchema, default: undefined },
        moderation: { type: ModerationSchema, default: () => ({}) },
    },
    { timestamps: true },
);

InternshipSchema.index({ "moderation.status": 1, createdAt: -1 });
InternshipSchema.index({ fingerprint: 1 }, { unique: true, sparse: true });

// Delete cached model in Next.js dev environment to ensure schema updates take effect
if (process.env.NODE_ENV !== "production" && mongoose.models.Internship) {
    delete mongoose.models.Internship;
}

const Internship: Model<IInternship> =
    mongoose.models.Internship ||
    mongoose.model<IInternship>("Internship", InternshipSchema);

export default Internship;
