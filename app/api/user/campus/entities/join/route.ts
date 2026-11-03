import { NextRequest, NextResponse } from "next/server";
import { joinCampus, type JoinTarget } from "@/lib/campus/student";
import { failure, limitStudentWrite, requireStudent } from "@/lib/campus/studentAuth";
import { clientIp, hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * POST { entityId | code, confirm: true, confirmSwitch?: true }.
 * 409 already_joined / has_active_applications per 6.4. A code attempt is rate limited per student and per address.
 */
export async function POST(request: NextRequest) {
    try {
        const me = await requireStudent();
        if (me instanceof NextResponse) return me;
        const limited = await limitStudentWrite(me.userId);
        if (limited) return limited;

        const body = await request.json().catch(() => null);
        let target: JoinTarget;
        if (typeof body?.code === "string") {
            const [u, ip] = await Promise.all([hit("campus:code:user", me.userId, RULES.campusJoinCodeUser), hit("campus:code:ip", clientIp(request), RULES.campusJoinCodeIp)]);
            if (!u.ok) return tooManyRequests(u.retryAfter);
            if (!ip.ok) return tooManyRequests(ip.retryAfter);
            target = { code: body.code };
        } else if (typeof body?.entityId === "string") {
            target = { entityId: body.entityId };
        } else {
            return NextResponse.json({ success: false, error: "Pick a campus or enter its code" }, { status: 400 });
        }

        const result = await joinCampus(me.userId, { target, confirm: body.confirm === true, confirmSwitch: body.confirmSwitch === true });
        return result.ok ? NextResponse.json({ success: true, data: { entityId: result.entityId, switched: result.switched } }) : failure(result);
    } catch (error) {
        console.error("[user/campus/entities/join]", error);
        return NextResponse.json({ success: false, error: "Unable to join" }, { status: 500 });
    }
}
