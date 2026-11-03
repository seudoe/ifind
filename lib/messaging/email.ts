import { log } from "@/lib/logger";
import type { DispatchResult, EmailMessage } from "./types";

/**
 * THE email transport seam. Everything that needs to email a person calls this, and nothing else sends email for the
 * campus feature. Contract for the real implementation:
 *   - exactly one recipient per call (`msg.to` is a single address);
 *   - idempotent on `msg.idempotencyKey` (a retry must not send twice);
 *   - never throw: return `{ ok: false, error }` instead;
 *   - honour the provider's rate limits internally.
 * Today there is no transport: it reports `skipped: "not_implemented"`.
 */
export async function dispatchEmail(msg: EmailMessage): Promise<DispatchResult> {
    if (!msg.to) return { ok: false, skipped: "no_recipient" };
    // IMPLEMENT HERE: e.g. delegate to lib/email/brevo.ts (build html from msg.html ?? msg.text, send to [{ email: msg.to, name: msg.toName }]).
    if (process.env.NODE_ENV === "development") {
        log.info("messaging/email", "not sent (no transport)", { domain: msg.to.split("@")[1] ?? "?", subject: msg.subject, tags: msg.tags?.join(",") });
    }
    return { ok: false, skipped: "not_implemented" };
}
