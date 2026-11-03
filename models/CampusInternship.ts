import mongoose, { type Document, type Model, Schema } from "mongoose";
import {
    CAMPUS_COMPANY_TIERS, CAMPUS_INTERNSHIP_STATUSES, CAMPUS_ROUND_TYPES, CAMPUS_WORK_MODES,
    type CampusEligibility, type CampusInternshipStatus,
} from "@/types/campus";
import { QUESTION_TYPES, type QuestionType } from "@/types/employer";
import type { Duration, Stipend } from "@/types/internship";

export interface ICampusScreeningQuestion {
    _id: mongoose.Types.ObjectId;
    question: string;
    type: QuestionType;
    options: string[];
    required: boolean;
}

export interface ICampusInternship extends Document {
    entityId: mongoose.Types.ObjectId;
    collegeId: mongoose.Types.ObjectId;
    postedBy: mongoose.Types.ObjectId;
    status: CampusInternshipStatus;
    /** The pasted paragraph the details were extracted from; kept for audit. */
    sourceText?: string | null;
    company: { name: string; logo?: string | null; website?: string | null; industry?: string | null; tier?: (typeof CAMPUS_COMPANY_TIERS)[number] | null };
    designation: string;
    description: string;
    deadlineDate?: Date | null;
    interviewDate?: Date | null;
    assessmentDate?: Date | null;
    resultDate?: Date | null;
    rounds: { name: string; type: (typeof CAMPUS_ROUND_TYPES)[number]; plannedDate?: Date | null; notes?: string | null }[];
    startDate?: Date | null;
    duration?: Duration | null;
    stipend?: Stipend | null;
    workMode: (typeof CAMPUS_WORK_MODES)[number];
    locations: string[];
    openings?: number | null;
    ppoAvailable: boolean;
    skills: string[];
    responsibilities: string[];
    perks: string[];
    eligibility: CampusEligibility;
    requireResume: boolean;
    screeningQuestions: ICampusScreeningQuestion[];
    maxApplications?: number | null;
    attachments: { name: string; url: string }[];
    closedAt?: Date | null;
    /** Set once when the "new internship" message fan-out ran, so a re-publish never double-sends. */
    emailedAt?: Date | null;
    /** Set when the 24h deadline reminder went out. */
    remindedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const ScreeningQuestionSchema = new Schema<ICampusScreeningQuestion>({
    question: { type: String, required: true, trim: true, maxlength: 300 },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
});

const str = { type: String, default: null, trim: true };

const CampusInternshipSchema = new Schema<ICampusInternship>(
    {
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", required: true },
        collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true },
        postedBy: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        status: { type: String, enum: CAMPUS_INTERNSHIP_STATUSES, default: "draft" },
        sourceText: { type: String, default: null, maxlength: 20000 },
        company: {
            type: new Schema(
                {
                    name: { type: String, required: true, trim: true, maxlength: 150 },
                    logo: str,
                    website: str,
                    industry: str,
                    tier: { type: String, enum: [...CAMPUS_COMPANY_TIERS, null], default: null },
                },
                { _id: false },
            ),
            required: true,
        },
        designation: { type: String, required: true, trim: true, maxlength: 150 },
        description: { type: String, default: "", maxlength: 10000 },
        deadlineDate: { type: Date, default: null },
        interviewDate: { type: Date, default: null },
        assessmentDate: { type: Date, default: null },
        resultDate: { type: Date, default: null },
        rounds: {
            type: [
                new Schema(
                    {
                        name: { type: String, required: true, trim: true, maxlength: 80 },
                        type: { type: String, enum: CAMPUS_ROUND_TYPES, default: "other" },
                        plannedDate: { type: Date, default: null },
                        notes: { type: String, default: null, maxlength: 500 },
                    },
                    { _id: false },
                ),
            ],
            default: [],
        },
        startDate: { type: Date, default: null },
        duration: { type: Schema.Types.Mixed, default: null },
        stipend: { type: Schema.Types.Mixed, default: null },
        workMode: { type: String, enum: CAMPUS_WORK_MODES, default: "onsite" },
        locations: { type: [String], default: [] },
        openings: { type: Number, default: null, min: 0 },
        ppoAvailable: { type: Boolean, default: false },
        skills: { type: [String], default: [] },
        responsibilities: { type: [String], default: [] },
        perks: { type: [String], default: [] },
        eligibility: {
            type: new Schema(
                {
                    batches: { type: [Number], default: [] },
                    courses: { type: [String], default: [] },
                    departments: { type: [String], default: [] },
                    minCgpa: { type: Number, default: null },
                    maxBacklogs: { type: Number, default: null },
                    other: { type: String, default: null, maxlength: 1000 },
                },
                { _id: false },
            ),
            default: () => ({}),
        },
        requireResume: { type: Boolean, default: true },
        screeningQuestions: {
            type: [ScreeningQuestionSchema],
            default: [],
            validate: [(v: unknown[]) => v.length <= 10, "At most 10 screening questions"],
        },
        maxApplications: { type: Number, default: null, min: 1 },
        attachments: { type: [new Schema({ name: { type: String, required: true }, url: { type: String, required: true } }, { _id: false })], default: [] },
        closedAt: { type: Date, default: null },
        emailedAt: { type: Date, default: null },
        remindedAt: { type: Date, default: null },
    },
    { timestamps: true, collection: "campus-internships" },
);

CampusInternshipSchema.index({ entityId: 1, status: 1, deadlineDate: 1 });
CampusInternshipSchema.index({ entityId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusInternship) delete mongoose.models.CampusInternship;

const CampusInternship: Model<ICampusInternship> =
    mongoose.models.CampusInternship || mongoose.model<ICampusInternship>("CampusInternship", CampusInternshipSchema);
export default CampusInternship;
