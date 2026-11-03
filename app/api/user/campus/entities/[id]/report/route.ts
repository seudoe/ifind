import { NextRequest, NextResponse } from "next/server";
import { reportCampus, reportSchema, retractReport } from "@/lib/campus/student";
import { failure, limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";
import { stripHtml } from "@/lib/employer/sanitize";
import { zodMessage } from "@/lib/employer/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST { reason, note? }: report a campus of your own college as not official. Reporting again changes the reason. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;
        const parsed = reportSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const result = await reportCampus(me.userId, (await params).id, stripHtml(parsed.data));
        return result.ok ? NextResponse.json({ success: true, data: { reportCount: result.reportCount } }) : failure(result);
    } catch (error) {
        console.error("[user/campus/report POST]", error);
        return NextResponse.json({ success: false, error: "Unable to send the report" }, { status: 500 });
    }
}

/** Retract your own report. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;
        const result = await retractReport(me.userId, (await params).id);
        return result.ok ? NextResponse.json({ success: true, data: { reportCount: result.reportCount } }) : failure(result);
    } catch (error) {
        console.error("[user/campus/report DELETE]", error);
        return NextResponse.json({ success: false, error: "Unable to retract the report" }, { status: 500 });
    }
}
