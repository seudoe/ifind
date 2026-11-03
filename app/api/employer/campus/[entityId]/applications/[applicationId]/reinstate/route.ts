import { NextRequest, NextResponse } from "next/server";
import { limitCampusWrite, requireCampusRole } from "@/lib/campus/access";
import { reinstate } from "@/lib/campus/pipeline";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";

export const runtime = "nodejs";

/** Let a removed student back into this internship. Coordinator and up. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ entityId: string; applicationId: string }> }) {
    const { entityId, applicationId } = await params;
    const access = await requireCampusRole(entityId, "coordinator");
    if (isResponse(access)) return access;
    const limited = await limitCampusWrite(access.employer._id);
    if (limited) return limited;
    const r = await reinstate(access.entity, applicationId, { id: access.employer._id, name: access.employer.name });
    return r.ok ? NextResponse.json({ success: true, data: { status: r.status } }) : failure(r);
}
