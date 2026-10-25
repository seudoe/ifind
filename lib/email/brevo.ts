/**
 * Brevo (ex-Sendinblue) transactional email over its REST API: no SDK, one POST.
 *
 *   BREVO_API_KEY         required to send; without it emails are skipped (logged) and the app keeps working
 *   BREVO_SENDER_EMAIL    required: a sender you verified in Brevo (Senders, Domains & Dedicated IPs)
 *   BREVO_SENDER_NAME     optional, default "iFind"
 *   BREVO_SANDBOX=true    optional: Brevo accepts the request but does NOT deliver (X-Sib-Sandbox: drop), for testing
 *   EMAIL_DISABLED=true   optional: never send (e.g. on a preview deployment)
 */
const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface EmailMessage {
    to: { email: string; name?: string }[];
    subject: string;
    html: string;
    text: string;
    /** Shown in Brevo's logs; lets you filter by notification type. */
    tags?: string[];
}

export const emailConfigured = () =>
    Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) && process.env.EMAIL_DISABLED !== "true";

/** Returns true when Brevo accepted the message. Never throws. */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
    if (!msg.to.length) return false;
    if (!emailConfigured()) {
        console.warn(`[email] skipped "${msg.subject}" (set BREVO_API_KEY and BREVO_SENDER_EMAIL to enable)`);
        return false;
    }
    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "api-key": process.env.BREVO_API_KEY as string,
                "content-type": "application/json",
                accept: "application/json",
                ...(process.env.BREVO_SANDBOX === "true" ? { "X-Sib-Sandbox": "drop" } : {}),
            },
            body: JSON.stringify({
                sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || "iFind" },
                to: msg.to,
                subject: msg.subject,
                htmlContent: msg.html,
                textContent: msg.text,
                ...(msg.tags?.length ? { tags: msg.tags } : {}),
            }),
            signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) {
            console.error(`[email] Brevo rejected "${msg.subject}": ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error("[email] Brevo unreachable:", err);
        return false;
    }
}
