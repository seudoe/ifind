import { log } from "@/lib/logger";
import OutboundMessage, { type IOutboundMessage } from "@/models/OutboundMessage";
import type { DispatchResult } from "./types";

type Row = Pick<IOutboundMessage, "channel" | "kind" | "refId" | "recipientType" | "recipientId" | "to" | "text" | "idempotencyKey"> &
    Partial<Pick<IOutboundMessage, "entityId" | "toName" | "subject" | "link" | "tags">>;

/**
 * Records a message BEFORE it is sent. Returns true when this call created the row (so the caller owns the first
 * attempt), false when a row for the same (channel, idempotencyKey) already exists (sent, failed or in flight: the
 * retry job, not a second caller, deals with it). Never throws: if the database is unreachable the caller still sends.
 */
export async function claimOutbox(row: Row): Promise<boolean> {
    try {
        const existing = await OutboundMessage.findOneAndUpdate(
            { channel: row.channel, idempotencyKey: row.idempotencyKey },
            { $setOnInsert: { ...row, status: "pending", attempts: 0 } },
            { upsert: true, returnDocument: "before" },
        ).select("_id");
        return existing === null;
    } catch (err) {
        if (typeof err === "object" && err && "code" in err && err.code === 11000) return false; // lost a race to another caller
        log.error("messaging/outbox", "claim failed", { error: err });
        return true;
    }
}

/**
 * Stores the outcome of an attempt: sent (time, provider id) or failed (time, reason). Used for the first attempt and
 * by whatever retry job later re-sends failed rows. A failure keeps the row retryable (`nextAttemptAt` = now).
 */
export async function finishOutbox(channel: IOutboundMessage["channel"], idempotencyKey: string, outcome: { result?: DispatchResult; thrown?: unknown }): Promise<void> {
    const now = new Date();
    const r = outcome.result;
    try {
        if (r?.ok) {
            await OutboundMessage.updateOne(
                { channel, idempotencyKey },
                { $set: { status: "sent", sentAt: now, lastAttemptAt: now, providerId: r.id ?? null, lastError: null, nextAttemptAt: null }, $inc: { attempts: 1 } },
            );
            return;
        }
        const reason = outcome.thrown instanceof Error ? outcome.thrown.message : outcome.thrown ? String(outcome.thrown) : (r?.error ?? r?.skipped ?? "unknown");
        await OutboundMessage.updateOne(
            { channel, idempotencyKey },
            { $set: { status: "failed", failedAt: now, lastAttemptAt: now, lastError: String(reason).slice(0, 500), nextAttemptAt: now }, $inc: { attempts: 1 } },
        );
    } catch (err) {
        log.error("messaging/outbox", "finish failed", { error: err });
    }
}
