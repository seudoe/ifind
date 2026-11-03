import mongoose, { type Document, type Model, Schema } from "mongoose";
import {
    CAMPUS_LISTINGS, CAMPUS_RESTRICTIONS, CAMPUS_ROLES,
    type CampusListing, type CampusRestriction, type CampusRole,
} from "@/types/campus";

export interface ICampusMember {
    employerId: mongoose.Types.ObjectId;
    role: CampusRole;
    addedBy?: mongoose.Types.ObjectId | null;
    addedAt: Date;
}

export interface ICampusEntity extends Document {
    collegeId: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    logo?: string | null;
    coverImage?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    joinCode: string;
    listing: CampusListing;
    courses: { name: string; departments: string[] }[];
    batches: number[];
    uidLabel: string;
    policy: { oneStudentOneOffer: boolean; acceptWindowHours?: number | null };
    members: ICampusMember[];
    createdBy: mongoose.Types.ObjectId;
    /** Denormalised from colleges.entity-reports. */
    reportCount: number;
    /** Denormalised count of enrollments with entityId = this. */
    studentCount: number;
    restriction: { status: CampusRestriction; reason?: string | null; by?: mongoose.Types.ObjectId | null; at?: Date | null };
    isActive: boolean;
    deleteDetails: { deleted: boolean; deletedAt?: Date | null };
    createdAt: Date;
    updatedAt: Date;
}

const MemberSchema = new Schema<ICampusMember>(
    {
        employerId: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        role: { type: String, enum: CAMPUS_ROLES, default: "coordinator" },
        addedBy: { type: Schema.Types.ObjectId, ref: "Employer", default: null },
        addedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const CampusEntitySchema = new Schema<ICampusEntity>(
    {
        collegeId: { type: Schema.Types.ObjectId, ref: "College", required: true },
        name: { type: String, required: true, trim: true, maxlength: 120 },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, default: "", maxlength: 2000 },
        logo: { type: String, default: null },
        coverImage: { type: String, default: null },
        contactEmail: { type: String, default: null, trim: true, lowercase: true },
        contactPhone: { type: String, default: null, trim: true },
        joinCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
        listing: { type: String, enum: CAMPUS_LISTINGS, default: "listed" },
        courses: {
            type: [new Schema({ name: { type: String, required: true, trim: true }, departments: { type: [String], default: [] } }, { _id: false })],
            default: [],
        },
        batches: { type: [Number], default: [] },
        uidLabel: { type: String, default: "College ID", trim: true, maxlength: 40 },
        policy: {
            type: new Schema({ oneStudentOneOffer: { type: Boolean, default: false }, acceptWindowHours: { type: Number, default: null } }, { _id: false }),
            default: () => ({ oneStudentOneOffer: false }),
        },
        members: { type: [MemberSchema], default: [] },
        createdBy: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        reportCount: { type: Number, default: 0, min: 0 },
        studentCount: { type: Number, default: 0, min: 0 },
        restriction: {
            type: new Schema(
                {
                    status: { type: String, enum: CAMPUS_RESTRICTIONS, default: "none" },
                    reason: { type: String, default: null },
                    by: { type: Schema.Types.ObjectId, ref: "Moderator", default: null },
                    at: { type: Date, default: null },
                },
                { _id: false },
            ),
            default: () => ({ status: "none" }),
        },
        isActive: { type: Boolean, default: true },
        deleteDetails: {
            type: new Schema({ deleted: { type: Boolean, default: false }, deletedAt: { type: Date, default: null } }, { _id: false }),
            default: () => ({ deleted: false, deletedAt: null }),
        },
    },
    { timestamps: true, collection: "colleges.entities" },
);

// slug and joinCode uniqueness come from `unique: true` above. Deliberately NO uniqueness on collegeId: many entities per college.
CampusEntitySchema.index({ collegeId: 1, isActive: 1 });
CampusEntitySchema.index({ "members.employerId": 1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusEntity) delete mongoose.models.CampusEntity;

const CampusEntity: Model<ICampusEntity> = mongoose.models.CampusEntity || mongoose.model<ICampusEntity>("CampusEntity", CampusEntitySchema);
export default CampusEntity;
