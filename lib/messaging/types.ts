/** Provider-agnostic outbound message shapes. One recipient per message, by construction: no shared visible "to". */
export interface EmailMessage {
    /** A single address. Never a list. */
    to: string;
    toName?: string;
    subject: string;
    text: string;
    html?: string;
    /** Path or URL the message points at (relative paths are resolved by the provider implementation). */
    link?: string;
    tags?: string[];
    /** Same key twice must not send twice. */
    idempotencyKey?: string;
}

export interface SmsMessage {
    /** A single phone number. */
    to: string;
    text: string;
    tags?: string[];
    idempotencyKey?: string;
}

export interface DispatchResult {
    ok: boolean;
    skipped?: "not_implemented" | "no_recipient" | "opted_out";
    id?: string;
    error?: string;
}
