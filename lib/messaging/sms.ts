import { log } from "@/lib/logger";
import type { DispatchResult, SmsMessage } from "./types";

/**
 * THE SMS transport seam (may never be implemented). Same contract as dispatchEmail: one recipient per call,
 * idempotent on `idempotencyKey`, never throws. Today there is no transport: it reports `skipped: "not_implemented"`.
 */
export async function dispatchSms(msg: SmsMessage): Promise<DispatchResult> {
    if (!msg.to) return { ok: false, skipped: "no_recipient" };
    // IMPLEMENT HERE: call the SMS provider.
    if (process.env.NODE_ENV === "development") {
        log.info("messaging/sms", "not sent (no transport)", { tags: msg.tags?.join(",") });
    }
    return { ok: false, skipped: "not_implemented" };
}
