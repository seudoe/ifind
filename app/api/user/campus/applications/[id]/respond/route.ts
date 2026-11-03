import { NextRequest, NextResponse } from "next/server";
import { respondToOffer } from "@/lib/campus/offers";
import { failure, limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** POST { decision: "accept" | "decline" }: answer an offer. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;
        const body = await request.json().catch(() => null);
        if (body?.decision !== "accept" && body?.decision !== "decline") return NextResponse.json({ success: false, error: "decision must be accept or decline" }, { status: 400 });
        const r = await respondToOffer(me.userId, (await params).id, body.decision);
        return r.ok ? NextResponse.json({ success: true, data: { status: r.status, withdrawnOthers: r.withdrawnOthers } }) : failure(r);
    } catch (error) {
        console.error("[user/campus/respond]", error);
        return NextResponse.json({ success: false, error: "Unable to record your answer" }, { status: 500 });
    }
}
