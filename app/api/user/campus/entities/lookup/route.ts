import { NextRequest, NextResponse } from "next/server";
import { lookupByCode } from "@/lib/campus/student";
import { failure, requireStudent } from "@/lib/campus/studentAuth";
import { clientIp, hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** POST { code }: shows which campus a join code belongs to before the student commits. Brute-force limited. */
export async function POST(request: NextRequest) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const [u, ip] = await Promise.all([hit("campus:code:user", me.userId, RULES.campusJoinCodeUser), hit("campus:code:ip", clientIp(request), RULES.campusJoinCodeIp)]);
        if (!u.ok) return tooManyRequests(u.retryAfter);
        if (!ip.ok) return tooManyRequests(ip.retryAfter);

        const body = await request.json().catch(() => null);
        const result = await lookupByCode(me.userId, typeof body?.code === "string" ? body.code : "");
        return result.ok ? NextResponse.json({ success: true, data: result.campus }) : failure(result);
    } catch (error) {
        console.error("[user/campus/entities/lookup]", error);
        return NextResponse.json({ success: false, error: "Unable to check that code" }, { status: 500 });
    }
}
