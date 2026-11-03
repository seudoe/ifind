import { NextRequest, NextResponse } from "next/server";
import { withdrawCampusApplication } from "@/lib/campus/applications";
import { limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** POST { confirmAccepted? }: withdraw your own application. An accepted offer needs confirmAccepted: true. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;
        const body = await request.json().catch(() => null);
        const result = await withdrawCampusApplication(me.userId, (await params).id, body?.confirmAccepted === true);
        return result.ok
            ? NextResponse.json({ success: true, data: { status: result.status } })
            : NextResponse.json({ success: false, error: result.error, code: result.code }, { status: result.status });
    } catch (error) {
        console.error("[user/campus/applications withdraw]", error);
        return NextResponse.json({ success: false, error: "Unable to withdraw" }, { status: 500 });
    }
}
