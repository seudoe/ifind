/**
 * Employer-supplied text is stored as plain text. React escapes it on render; this also strips markup
 * and control characters on the way in so it never reaches another consumer (email, PDF, a future
 * non-React client) as live HTML.
 */
const TAGS = /<\/?[a-z!][^>]*>/gi; // needs a closing ">" so a lone "x<y" survives
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function plainText(s: string): string {
    // Loop: "<scr<script>ipt>" collapses to "<script>" after one pass
    let prev: string;
    let out = s.replace(CONTROL, "");
    do {
        prev = out;
        out = out.replace(TAGS, "");
    } while (out !== prev);
    return out.trim();
}

/** Deep-sanitize every string in a parsed request body (arrays and nested objects included). */
export function stripHtml<T>(value: T): T {
    if (typeof value === "string") return plainText(value) as T;
    if (Array.isArray(value)) return value.map(stripHtml) as T;
    if (value instanceof Date) return value;
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripHtml(v)])) as T;
    }
    return value;
}
