import { NextRequest, NextResponse } from "next/server";
import { applySchema, applyToCampusInternship } from "@/lib/campus/apply";
import { failure, limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";
import { stripHtml } from "@/lib/employer/sanitize";
import { zodMessage } from "@/lib/employer/validation";

export const runtime = "nodejs";

/** POST { confirm: true, coverLetter?, answers[] }. Every block of 6.6 is enforced in applyToCampusInternship. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;
        const parsed = applySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const result = await applyToCampusInternship(me.userId, (await params).id, { ...parsed.data, coverLetter: stripHtml(parsed.data.coverLetter) });
        return result.ok ? NextResponse.json({ success: true, data: { applicationId: result.applicationId } }, { status: 201 }) : failure(result);
    } catch (error) {
        console.error("[user/campus/apply]", error);
        return NextResponse.json({ success: false, error: "Unable to send your application" }, { status: 500 });
    }
}
