import mongoose, { type Document, type Model, Schema } from "mongoose";
import {
    COMPANY_SIZES, COMPANY_TYPES, MEMBER_ROLES, VERIFICATION_STATUSES,
    type CompanySize, type CompanyType, type MemberRole, type VerificationStatus,
} from "@/types/employer";

export interface ICompanyMember {
    employerId: mongoose.Types.ObjectId;
    role: MemberRole;
    addedBy?: mongoose.Types.ObjectId | null;
    addedAt: Date;
}

export interface ICompany extends Document {
    name: string;
    slug: string;
    legalName?: string | null;
    tagline?: string | null;
    description: string;
    logo?: string | null;
    coverImage?: string | null;
    website?: string | null;
    industry: string;
    companyType: CompanyType;
    size: CompanySize;
    foundedYear?: number | null;
    headquarters: {
        line1?: string | null; line2?: string | null; city: string;
        state?: string | null; country: string; pincode?: string | null;
    };
    officeLocations: string[];
    contactEmail: string;
    contactPhone?: string | null;
    socials: { linkedin?: string | null; twitter?: string | null; instagram?: string | null; github?: string | null };
    registration: { gstin?: string | null; cin?: string | null; pan?: string | null };
    perks: string[];
    techStack: string[];
    members: ICompanyMember[];
    createdBy: mongoose.Types.ObjectId;
    verification: {
        status: VerificationStatus;
        submittedAt?: Date | null;
        reviewedBy?: mongoose.Types.ObjectId | null;
        reviewedAt?: Date | null;
        rejectionReason?: string | null;
    };
    isActive: boolean;
    deleteDetails: { deleted: boolean; deletedAt: Date | null };
    createdAt: Date;
    updatedAt: Date;
}

const str = { type: String, default: null, trim: true };

const MemberSchema = new Schema<ICompanyMember>(
    {
        employerId: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        role: { type: String, enum: MEMBER_ROLES, required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: "Employer", default: null },
        addedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const CompanySchema = new Schema<ICompany>(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        legalName: str,
        tagline: { ...str, maxlength: 120 },
        description: { type: String, required: true, trim: true, maxlength: 5000 },
        logo: str,
        coverImage: str,
        website: str,
        industry: { type: String, required: true, trim: true },
        companyType: { type: String, enum: COMPANY_TYPES, required: true },
        size: { type: String, enum: COMPANY_SIZES, required: true },
        foundedYear: { type: Number, default: null },
        headquarters: {
            type: new Schema(
                {
                    line1: str,
                    line2: str,
                    city: { type: String, required: true, trim: true },
                    state: str,
                    country: { type: String, required: true, trim: true, default: "India" },
                    pincode: str,
                },
                { _id: false },
            ),
            required: true,
        },
        officeLocations: { type: [String], default: [] },
        contactEmail: { type: String, required: true, lowercase: true, trim: true },
        contactPhone: str,
        socials: {
            type: new Schema({ linkedin: str, twitter: str, instagram: str, github: str }, { _id: false }),
            default: () => ({}),
        },
        registration: {
            type: new Schema(
                {
                    gstin: { ...str, uppercase: true },
                    cin: { ...str, uppercase: true },
                    pan: { ...str, uppercase: true },
                },
                { _id: false },
            ),
            default: () => ({}),
        },
        perks: { type: [String], default: [] },
        techStack: { type: [String], default: [] },
        members: { type: [MemberSchema], default: [] },
        createdBy: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        verification: {
            type: new Schema(
                {
                    status: { type: String, enum: VERIFICATION_STATUSES, default: "unverified" },
                    submittedAt: { type: Date, default: null },
                    reviewedBy: { type: Schema.Types.ObjectId, ref: "Moderator", default: null },
                    reviewedAt: { type: Date, default: null },
                    rejectionReason: { type: String, default: null },
                },
                { _id: false },
            ),
            default: () => ({ status: "unverified" }),
        },
        isActive: { type: Boolean, default: true },
        deleteDetails: {
            type: new Schema({ deleted: { type: Boolean, default: false }, deletedAt: { type: Date, default: null } }, { _id: false }),
            default: () => ({ deleted: false, deletedAt: null }),
        },
    },
    { timestamps: true },
);

CompanySchema.index({ "members.employerId": 1 });
CompanySchema.index({ "verification.status": 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.Company) {
    delete mongoose.models.Company;
}

const Company: Model<ICompany> =
    mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema, "companies");

export default Company;
