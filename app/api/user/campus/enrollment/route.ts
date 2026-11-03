import { NextRequest, NextResponse } from "next/server";
import { stripHtml } from "@/lib/employer/sanitize";
import { zodMessage } from "@/lib/employer/validation";
import { campusState, enrollmentSchema, saveEnrollment } from "@/lib/campus/student";
import { limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    return NextResponse.json({ success: true, data: (await campusState(me.userId)).enrollment });
}

/** Create or update the student's college details. Works with no campus joined. */
export async function PUT(request: NextRequest) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;

        const body = await request.json().catch(() => null);
        const parsed = enrollmentSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const saved = await saveEnrollment(me.userId, stripHtml(parsed.data));
        if (!saved.ok) return NextResponse.json({ success: false, error: saved.error, code: saved.code }, { status: saved.status });
        return NextResponse.json({ success: true, data: await campusState(me.userId) });
    } catch (error) {
        console.error("[user/campus/enrollment PUT]", error);
        return NextResponse.json({ success: false, error: "Unable to save your details" }, { status: 500 });
    }
}
