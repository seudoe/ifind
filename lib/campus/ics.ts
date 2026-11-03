/** Minimal RFC 5545 calendar file for one event. Text is escaped and lines folded, so event text cannot inject properties. */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
/** Control characters have no place in a property value. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

/** Lines longer than 75 octets are folded with CRLF + space (counting bytes, not characters). */
export function fold(line: string): string {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return line;
    const parts: string[] = [];
    let start = 0;
    let limit = 75;
    while (start < bytes.length) {
        let end = Math.min(start + limit, bytes.length);
        while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // do not cut a multi-byte character
        parts.push(bytes.subarray(start, end).toString("utf8"));
        start = end;
        limit = 74; // continuation lines start with a space
    }
    return parts.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export interface IcsEvent {
    id: string;
    title: string;
    body?: string;
    startsAt: Date;
    endsAt?: Date | null;
    venue?: string | null;
    link?: string | null;
    cancelled?: boolean;
    sequence?: number;
    organizer?: string;
}

export function buildIcs(e: IcsEvent, now = new Date()): string {
    const end = e.endsAt && e.endsAt > e.startsAt ? e.endsAt : new Date(e.startsAt.getTime() + 60 * 60 * 1000);
    const lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//iFind//Campus Internships//EN", "CALSCALE:GREGORIAN", `METHOD:${e.cancelled ? "CANCEL" : "PUBLISH"}`,
        "BEGIN:VEVENT",
        `UID:${e.id}@ifind-campus`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(e.startsAt)}`,
        `DTEND:${stamp(end)}`,
        `SEQUENCE:${e.sequence ?? 0}`,
        `SUMMARY:${esc(clean(e.title))}`,
        ...(e.body ? [`DESCRIPTION:${esc(clean(e.body))}`] : []),
        ...(e.venue ? [`LOCATION:${esc(clean(e.venue))}`] : []),
        ...(e.link && /^https?:\/\//i.test(e.link) ? [`URL:${clean(e.link).replace(/[\r\n]/g, "")}`] : []),
        ...(e.organizer ? [`ORGANIZER;CN=${esc(clean(e.organizer)).replace(/[:"]/g, "")}:mailto:noreply@ifind.invalid`] : []),
        `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
        "END:VEVENT", "END:VCALENDAR",
    ];
    return lines.map(fold).join("\r\n") + "\r\n";
}
