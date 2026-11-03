import { NextRequest, NextResponse } from "next/server";
import { setPreferences } from "@/lib/campus/student";
import { failure, limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";

export const runtime = "nodejs";

/** PATCH { emailUpdates?, smsUpdates? }: which campus messages reach this student. */
export async function PATCH(request: NextRequest) {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const limited = await limitStudentWrite(me.userId);
    if (limited) return limited;
    const body = await request.json().catch(() => null);
    const r = await setPreferences(me.userId, { emailUpdates: typeof body?.emailUpdates === "boolean" ? body.emailUpdates : undefined, smsUpdates: typeof body?.smsUpdates === "boolean" ? body.smsUpdates : undefined });
    return r.ok ? NextResponse.json({ success: true, data: { emailUpdates: r.emailUpdates, smsUpdates: r.smsUpdates } }) : failure(r);
}
