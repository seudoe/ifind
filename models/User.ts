import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface IResume {
    driveFileId?: string | null;
    driveViewLink?: string | null;
    uploadedAt?: Date | null;
    parsedData?: any | null;
    tfidf_vector?: number[] | null;
    bert_vector?: number[] | null;
    pendingFileId?: string | null;
    pendingViewLink?: string | null;
    pendingParsedData?: any | null;
}

export interface IAppliedInternship {
    internshipId: mongoose.Types.ObjectId;
    appliedAt: Date;
    status: "applied" | "shortlisted" | "rejected" | "selected";
}

export interface IRecommendationScore {
    id: mongoose.Types.ObjectId;
    score: number;
}

export interface IRecommendedInternships {
    updatedAt?: Date | null;
    recommendedList?: mongoose.Types.ObjectId[];
    recommendedScores?: IRecommendationScore[];
}

export interface IDeleteDetails {
    deleted?: boolean | null;
    deletedAt?: Date | string | null;
}

export interface IUser extends Document {
    name: string;
    username: string;
    email: string;
    password?: string;
    linkedinId?: string;
    linkedinDetails?: any;
    profilePicture?: string | null;
    role: "student";
    phone?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    city: string | null;
    state?: string | null;
    country?: string | null;
    skills?: string[];
    resume: IResume;
    appliedInternships: IAppliedInternship[];
    savedInternships: mongoose.Types.ObjectId[];
    recommendedInternships?: IRecommendedInternships;
    deleteDetails?: IDeleteDetails;
    profileCompletionScore: number;
    isBanned?: boolean;
    bannedReason?: string | null;
    bannedBy?: mongoose.Types.ObjectId | null;
    bannedAt?: Date | null;
    aiExtractionUsedThisMonth?: number;
    aiExtractionMonthYear?: string | null;
    vectorizationStatus: "idle" | "processing" | "completed" | "failed";
    createdAt: Date;
    updatedAt: Date;
}

const ResumeSchema = new Schema(
    {
        driveFileId: { type: String, default: null },
        driveViewLink: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
        parsedData: { type: Schema.Types.Mixed, default: null },
        tfidf_vector: { type: Schema.Types.Mixed, default: null },
        bert_vector: { type: Schema.Types.Mixed, default: null },
        pendingFileId: { type: String, default: null },
        pendingViewLink: { type: String, default: null },
        pendingParsedData: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false },
);
const AppliedInternshipSchema = new Schema(
    {
        internshipId: { type: Schema.Types.ObjectId, ref: "Internship" },
        appliedAt: { type: Date, default: Date.now },
        status: {
            type: String,
            enum: ["applied", "shortlisted", "rejected", "selected"],
            default: "applied",
        },
    },
    { _id: false },
);

const RecommendedInternshipsSchema = new Schema(
    {
        updatedAt: { type: Date, default: null },
        recommendedList: {
            type: [{ type: Schema.Types.ObjectId, ref: "Internship" }],
            default: [],
        },
        recommendedScores: { type: Schema.Types.Mixed, default: [] },
    },
    { _id: false },
);

const DeleteDetailsSchema = new Schema(
    {
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null },
    },
    { _id: false },
);

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: false, select: false },
        linkedinId: { type: String, default: null, trim: true },
        linkedinDetails: { type: Schema.Types.Mixed, default: null },
        profilePicture: { type: String, default: null },
        role: { type: String, enum: ["student"], default: "student" },
        phone: { type: String, default: null, trim: true },
        dateOfBirth: { type: String, default: null, trim: true },
        gender: { type: String, default: null, trim: true },
        city: { type: String, default: null, trim: true },
        state: { type: String, default: null, trim: true },
        country: { type: String, default: null, trim: true },
        skills: { type: [String], default: [] },
        resume: { type: ResumeSchema, default: () => ({}) },
        appliedInternships: { type: [AppliedInternshipSchema], default: [] },
        savedInternships: { type: [Schema.Types.ObjectId], default: [] },
        recommendedInternships: {
            type: RecommendedInternshipsSchema,
            default: () => ({}),
        },
        deleteDetails: {
            type: DeleteDetailsSchema,
            default: () => ({ deleted: false, deletedAt: null }),
        },
        profileCompletionScore: { type: Number, default: 20 },
        isBanned: { type: Boolean, default: false },
        bannedReason: { type: String, default: null },
        bannedBy: {
            type: Schema.Types.ObjectId,
            ref: "Moderator",
            default: null,
        },
        bannedAt: { type: Date, default: null },
        aiExtractionUsedThisMonth: { type: Number, default: 0 },
        aiExtractionMonthYear: { type: String, default: null }, // format: "YYYY-MM"
        vectorizationStatus: { type: String, enum: ["idle", "processing", "completed", "failed"], default: "idle" },
    },
    { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ linkedinId: 1 }, { unique: true, sparse: true });

// Delete cached model in Next.js dev environment to ensure schema updates take effect
if (process.env.NODE_ENV !== "production" && mongoose.models.User) {
    delete mongoose.models.User;
}

const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
