import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/campus/studentAuth";
import { loadCampusApplied } from "@/lib/campus/studentApplications";

export const runtime = "nodejs";

/** The student's campus applications (they stay visible after leaving a campus). Student-safe fields only. */
export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    return NextResponse.json({ success: true, data: { items: await loadCampusApplied(me.userId) } });
}
