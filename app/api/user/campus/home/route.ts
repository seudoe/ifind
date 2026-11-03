import { NextResponse } from "next/server";
import { homeFeed } from "@/lib/campus/events";
import { requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** The events and announcements this student may see on their campus (audience rules applied, tags computed). */
export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    return NextResponse.json({ success: true, data: { items: (await homeFeed(me.userId)) ?? [] } });
}
