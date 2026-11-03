import { NextRequest, NextResponse } from "next/server";
import { eventForStudent } from "@/lib/campus/events";
import { buildIcs } from "@/lib/campus/ics";
import { requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** Calendar file for one event the student is allowed to see. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const e = await eventForStudent(me.userId, (await params).id);
    const when = e?.startsAt ?? e?.deadlineAt;
    if (!e || !when) return NextResponse.json({ success: false, error: "This event has no date to add to a calendar" }, { status: 404 });
    const ics = buildIcs({ id: String(e._id), title: e.title, body: e.body, startsAt: when, endsAt: e.startsAt ? e.endsAt : null, venue: e.venue, link: e.link, cancelled: e.status === "cancelled", sequence: e.version });
    return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="campus-event.ics"', "Cache-Control": "private, no-store" } });
}
