import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { rotateJoinCode } from "@/lib/campus/entities";
import { isResponse } from "@/lib/employer/access";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** Admin and up. The old code stops working immediately; students who already joined are unaffected. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ entityId: string }> }) {
    try {
        const access = await requireCampusRole((await params).entityId, "admin");
        if (isResponse(access)) return access;
        const limited = await hit("campus:rotate-code", String(access.entity._id), RULES.sensitiveUser);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);
        const joinCode = await rotateJoinCode(access.entity);
        return NextResponse.json({ success: true, data: { joinCode } });
    } catch (error) {
        console.error("[employer/campus code/rotate]", error);
        return NextResponse.json({ success: false, error: "Unable to rotate the code" }, { status: 500 });
    }
}
