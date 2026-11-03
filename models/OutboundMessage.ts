import mongoose, { type Document, type Model, Schema } from "mongoose";

export const OUTBOX_CHANNELS = ["email", "sms"] as const;
/** pending: claimed and being sent (a row that stays pending is a crashed send). sent: provider accepted it. failed: not sent (error or no transport yet); a retry job may pick it up. */
export const OUTBOX_STATUSES = ["pending", "sent", "failed"] as const;

export interface IOutboundMessage extends Document {
    channel: (typeof OUTBOX_CHANNELS)[number];
    status: (typeof OUTBOX_STATUSES)[number];
    kind: string;
    refId: string;
    entityId?: mongoose.Types.ObjectId | null;
    recipientType: "student" | "employer";
    recipientId: string;
    /** Address or phone number, kept so a retry job can send without re-resolving the recipient. */
    to: string;
    toName?: string | null;
    subject?: string | null;
    text: string;
    link?: string | null;
    tags: string[];
    idempotencyKey: string;
    attempts: number;
    lastAttemptAt?: Date | null;
    sentAt?: Date | null;
    /** Time of the latest failure. Kept as history after a later success; `sentAt` tells the final outcome. */
    failedAt?: Date | null;
    lastError?: string | null;
    providerId?: string | null;
    /** A retry job picks rows with status failed (or stale pending) whose nextAttemptAt has passed. */
    nextAttemptAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const OutboundMessageSchema = new Schema<IOutboundMessage>(
    {
        channel: { type: String, enum: OUTBOX_CHANNELS, required: true },
        status: { type: String, enum: OUTBOX_STATUSES, default: "pending" },
        kind: { type: String, required: true },
        refId: { type: String, required: true },
        entityId: { type: Schema.Types.ObjectId, default: null },
        recipientType: { type: String, enum: ["student", "employer"], required: true },
        recipientId: { type: String, required: true },
        to: { type: String, required: true },
        toName: { type: String, default: null },
        subject: { type: String, default: null },
        text: { type: String, required: true },
        link: { type: String, default: null },
        tags: { type: [String], default: [] },
        idempotencyKey: { type: String, required: true },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: null },
        sentAt: { type: Date, default: null },
        failedAt: { type: Date, default: null },
        lastError: { type: String, default: null, maxlength: 500 },
        providerId: { type: String, default: null },
        nextAttemptAt: { type: Date, default: null },
    },
    { timestamps: true, collection: "messaging.outbox" },
);

// One row per (channel, key): the same message version is never sent twice, and a retry job updates the row in place.
OutboundMessageSchema.index({ channel: 1, idempotencyKey: 1 }, { unique: true });
OutboundMessageSchema.index({ status: 1, nextAttemptAt: 1 });
OutboundMessageSchema.index({ recipientId: 1, createdAt: -1 });

if (process.env.NODE_ENV !== "production" && mongoose.models.OutboundMessage) delete mongoose.models.OutboundMessage;

const OutboundMessage: Model<IOutboundMessage> = mongoose.models.OutboundMessage || mongoose.model<IOutboundMessage>("OutboundMessage", OutboundMessageSchema);
export default OutboundMessage;
