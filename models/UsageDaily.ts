import mongoose, { type Model, Schema } from "mongoose";

/** Per-day totals, kept permanently. One document per (scope, subject, IST day); also written by internScraper. */
export interface IUsageDaily {
  scope: "user" | "system";
  /** User id, or a system source name; "all" holds the system total used for the daily budget. */
  subject: string;
  day: string;
  creditsUsed: number;
  requests: number;
  blocked: number;
  refunds: number;
  hitLimit: boolean;
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  byFeature: Record<string, number>;
  updatedAt: Date;
}

const UsageDailySchema = new Schema<IUsageDaily>(
  {
    scope: { type: String, enum: ["user", "system"], required: true },
    subject: { type: String, required: true },
    day: { type: String, required: true },
    creditsUsed: { type: Number, default: 0 },
    requests: { type: Number, default: 0 },
    blocked: { type: Number, default: 0 },
    refunds: { type: Number, default: 0 },
    hitLimit: { type: Boolean, default: false },
    llmCalls: { type: Number, default: 0 },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    byFeature: { type: Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "usage.daily", versionKey: false, minimize: false },
);

UsageDailySchema.index({ scope: 1, subject: 1, day: 1 }, { unique: true });
UsageDailySchema.index({ day: 1, costUsd: -1 });

const UsageDaily: Model<IUsageDaily> =
  mongoose.models.UsageDaily || mongoose.model<IUsageDaily>("UsageDaily", UsageDailySchema);
export default UsageDaily;
