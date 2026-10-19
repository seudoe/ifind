import mongoose, { type Model, Schema } from "mongoose";

/** Every ban and unban, with the user's signals at that moment, so a decision can be reviewed later. */
export interface IBanEvent {
  userId: mongoose.Types.ObjectId;
  action: "ban" | "unban";
  reason: string | null;
  moderatorId: mongoose.Types.ObjectId;
  moderatorName?: string | null;
  signals?: unknown;
  at: Date;
}

const BanEventSchema = new Schema<IBanEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: ["ban", "unban"], required: true },
    reason: { type: String, default: null },
    moderatorId: { type: Schema.Types.ObjectId, ref: "Moderator", required: true },
    moderatorName: { type: String, default: null },
    signals: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now },
  },
  { collection: "ban.events", versionKey: false },
);

const BanEvent: Model<IBanEvent> = mongoose.models.BanEvent || mongoose.model<IBanEvent>("BanEvent", BanEventSchema);
export default BanEvent;
