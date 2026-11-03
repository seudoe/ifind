import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface ICampusBlacklist extends Document {
    entityId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    reason: string;
    bannedBy: mongoose.Types.ObjectId;
    bannedAt: Date;
    active: boolean;
    liftedBy?: mongoose.Types.ObjectId | null;
    liftedAt?: Date | null;
}

const CampusBlacklistSchema = new Schema<ICampusBlacklist>(
    {
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", required: true },
        studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, required: true, trim: true, maxlength: 500 },
        bannedBy: { type: Schema.Types.ObjectId, ref: "Employer", required: true },
        bannedAt: { type: Date, default: Date.now },
        active: { type: Boolean, default: true },
        liftedBy: { type: Schema.Types.ObjectId, ref: "Employer", default: null },
        liftedAt: { type: Date, default: null },
    },
    { collection: "colleges.blacklist" },
);
// At most one ACTIVE ban per (entity, student); lifted rows are kept as history.
CampusBlacklistSchema.index({ entityId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { active: true } });
CampusBlacklistSchema.index({ entityId: 1, active: 1, bannedAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusBlacklist) delete mongoose.models.CampusBlacklist;

const CampusBlacklist: Model<ICampusBlacklist> =
    mongoose.models.CampusBlacklist || mongoose.model<ICampusBlacklist>("CampusBlacklist", CampusBlacklistSchema);
export default CampusBlacklist;
