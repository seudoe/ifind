import { NextResponse } from "next/server";
import { campusesFor, getEnrollment } from "@/lib/campus/student";
import { requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** Campuses of the student's own college (never another college's), with counts. No join codes. */
export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const enrollment = await getEnrollment(me.userId);
    if (!enrollment) return NextResponse.json({ success: false, error: "Fill in your college details first.", code: "no_enrollment" }, { status: 400 });
    return NextResponse.json({ success: true, data: await campusesFor(enrollment, me.userId) });
}
