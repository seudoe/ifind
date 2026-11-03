import { NextResponse } from "next/server";
import { campusState } from "@/lib/campus/student";
import { requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** Details, college, current campus and banner for the student campus area. */
export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    return NextResponse.json({ success: true, data: await campusState(me.userId) });
}
