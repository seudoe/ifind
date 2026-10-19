import mongoose, { type Model, Schema } from "mongoose";

/** Single document (_id "global") with the limits moderators can change without a deploy. */
export interface IUsageSettings {
  _id: string;
  defaultDailyCredits?: number;
  systemDailyBudgetUsd?: number;
  featureCredits?: Record<string, number>;
  flagThresholds?: Record<string, number>;
  updatedAt?: Date;
  updatedBy?: string | null;
}

const UsageSettingsSchema = new Schema<IUsageSettings>(
  {
    _id: { type: String },
    defaultDailyCredits: { type: Number },
    systemDailyBudgetUsd: { type: Number },
    featureCredits: { type: Schema.Types.Mixed },
    flagThresholds: { type: Schema.Types.Mixed },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: null },
  },
  { collection: "usage.settings", versionKey: false },
);

const UsageSettings: Model<IUsageSettings> =
  mongoose.models.UsageSettings || mongoose.model<IUsageSettings>("UsageSettings", UsageSettingsSchema);
export default UsageSettings;
