import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { cancelEvent } from "@/lib/campus/events";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";

export const runtime = "nodejs";

/** Cancel an event. The audience is told once; the event stays visible, marked cancelled. Coordinator and up. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ entityId: string; eventId: string }> }) {
    const { entityId, eventId } = await params;
    const access = await requireCampusRole(entityId, "coordinator");
    if (isResponse(access)) return access;
    const r = await cancelEvent(access.entity, eventId);
    return r.ok ? NextResponse.json({ success: true }) : failure(r);
}
