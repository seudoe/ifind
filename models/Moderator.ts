import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface IModerator extends Document {
    name: string;
    email: string;
    password?: string;
    isVerified: boolean;
    verifiedBy?: mongoose.Types.ObjectId | null;
    verifiedAt?: Date | null;
    role: "moderator";
    isBanned: boolean;
    bannedBy?: mongoose.Types.ObjectId | null;
    bannedAt?: Date | null;
    bannedReason?: string | null;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

const ModeratorSchema = new Schema<IModerator>(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: false, select: false },
        isVerified: { type: Boolean, default: false },
        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: "Moderator",
            default: null,
        },
        verifiedAt: { type: Date, default: null },
        role: { type: String, enum: ["moderator"], default: "moderator" },
        isBanned: { type: Boolean, default: false },
        bannedBy: { type: Schema.Types.ObjectId, ref: "Moderator", default: null },
        bannedAt: { type: Date, default: null },
        bannedReason: { type: String, default: null },
        priority: { type: Number, default: 999 },
    },
    { timestamps: true },
);

ModeratorSchema.index({ email: 1 }, { unique: true });

// Delete cached model in Next.js dev environment to ensure schema updates take effect
if (process.env.NODE_ENV !== "production" && mongoose.models.Moderator) {
    delete mongoose.models.Moderator;
}

const Moderator: Model<IModerator> =
    mongoose.models.Moderator ||
    mongoose.model<IModerator>("Moderator", ModeratorSchema);

export default Moderator;
