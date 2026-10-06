import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface IEmployer extends Document {
    name: string;
    email: string;
    password?: string;
    isEmailVerified: boolean;
    linkedinId?: string | null;
    linkedinDetails?: unknown;
    profilePicture?: string | null;
    phone?: string | null;
    designation?: string | null;
    role: "employer";
    isBanned: boolean;
    bannedReason?: string | null;
    bannedBy?: mongoose.Types.ObjectId | null;
    bannedAt?: Date | null;
    lastLoginAt?: Date | null;
    deleteDetails: { deleted: boolean; deletedAt: Date | null };
    createdAt: Date;
    updatedAt: Date;
}

const EmployerSchema = new Schema<IEmployer>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: false, select: false },
        isEmailVerified: { type: Boolean, default: false },
        linkedinId: { type: String, default: undefined },
        linkedinDetails: { type: Schema.Types.Mixed, default: null },
        profilePicture: { type: String, default: null },
        phone: { type: String, default: null, trim: true },
        designation: { type: String, default: null, trim: true },
        role: { type: String, enum: ["employer"], default: "employer" },
        isBanned: { type: Boolean, default: false },
        bannedReason: { type: String, default: null },
        bannedBy: { type: Schema.Types.ObjectId, ref: "Moderator", default: null },
        bannedAt: { type: Date, default: null },
        lastLoginAt: { type: Date, default: null },
        deleteDetails: {
            type: new Schema({ deleted: { type: Boolean, default: false }, deletedAt: { type: Date, default: null } }, { _id: false }),
            default: () => ({ deleted: false, deletedAt: null }),
        },
    },
    { timestamps: true },
);

// unique sparse: password-only employers have no linkedinId at all
EmployerSchema.index({ linkedinId: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.Employer) {
    delete mongoose.models.Employer;
}

const Employer: Model<IEmployer> =
    mongoose.models.Employer || mongoose.model<IEmployer>("Employer", EmployerSchema, "employers");

export default Employer;
