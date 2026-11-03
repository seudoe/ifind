import { NextRequest, NextResponse } from "next/server";
import { blockersFor, getEnrollment, leaveCampus } from "@/lib/campus/student";
import { failure, limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** Active applications that currently block leaving or switching (the red panel lists them with Withdraw). */
export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const enrollment = await getEnrollment(me.userId);
    const blockers = enrollment?.entityId ? await blockersFor(me.userId, enrollment.entityId) : [];
    return NextResponse.json({ success: true, data: { blockers } });
}

/** POST { confirm: true }. Refused (409 has_active_applications) while any application is active. */
export async function POST(request: NextRequest) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;
        const body = await request.json().catch(() => null);
        const result = await leaveCampus(me.userId, body?.confirm === true);
        return result.ok ? NextResponse.json({ success: true }) : failure(result);
    } catch (error) {
        console.error("[user/campus/entities/leave]", error);
        return NextResponse.json({ success: false, error: "Unable to leave" }, { status: 500 });
    }
}
