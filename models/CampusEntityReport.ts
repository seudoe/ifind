import mongoose, { type Document, type Model, Schema } from "mongoose";
import { CAMPUS_REPORT_REASONS, type CampusReportReason } from "@/types/campus";

export interface ICampusEntityReport extends Document {
    entityId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    reason: CampusReportReason;
    note?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const CampusEntityReportSchema = new Schema<ICampusEntityReport>(
    {
        entityId: { type: Schema.Types.ObjectId, ref: "CampusEntity", required: true },
        studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, enum: CAMPUS_REPORT_REASONS, required: true },
        note: { type: String, default: null, maxlength: 500 },
    },
    { timestamps: true, collection: "colleges.entity-reports" },
);
CampusEntityReportSchema.index({ entityId: 1, studentId: 1 }, { unique: true });

if (process.env.NODE_ENV !== "production" && mongoose.models.CampusEntityReport) delete mongoose.models.CampusEntityReport;

const CampusEntityReport: Model<ICampusEntityReport> =
    mongoose.models.CampusEntityReport || mongoose.model<ICampusEntityReport>("CampusEntityReport", CampusEntityReportSchema);
export default CampusEntityReport;
