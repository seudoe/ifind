import mongoose, { type Model, Schema } from "mongoose";

/** Per-call log shared with internScraper (usage_log.py writes the same shape). Expires after 90 days. */
export interface IUsageLog {
  ts: Date;
  /** "request" is one HTTP request to a billed route; "call" is one provider call made while serving it. */
  kind: "request" | "call";
  scope: "user" | "system";
  /** User id for scope "user"; source name (github, telegram, ...) for scope "system". */
  subject: string;
  feature: string;
  requestId?: string | null;
  provider?: string | null;
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  credits?: number;
  status: "ok" | "error" | "blocked" | "refunded";
  /** Hash of route + body, never the content, so repeated identical requests can be spotted. */
  reqHash?: string | null;
  error?: string | null;
  /** Who triggered a system call, e.g. the Telegram user id; written by internScraper. */
  actor?: string | null;
}

const UsageLogSchema = new Schema<IUsageLog>(
  {
    ts: { type: Date, default: Date.now },
    kind: { type: String, enum: ["request", "call"], required: true },
    scope: { type: String, enum: ["user", "system"], required: true },
    subject: { type: String, required: true },
    feature: { type: String, required: true },
    requestId: { type: String, default: null },
    provider: { type: String, default: null },
    model: { type: String, default: null },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    status: { type: String, enum: ["ok", "error", "blocked", "refunded"], required: true },
    reqHash: { type: String, default: null },
    error: { type: String, default: null },
    actor: { type: String, default: null },
  },
  { collection: "llm.usage", versionKey: false },
);

UsageLogSchema.index({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
UsageLogSchema.index({ scope: 1, subject: 1, ts: -1 });

const UsageLog: Model<IUsageLog> = mongoose.models.UsageLog || mongoose.model<IUsageLog>("UsageLog", UsageLogSchema);
export default UsageLog;
