import { NextRequest, NextResponse } from "next/server";
import { limitCampusWrite, requireCampusRole } from "@/lib/campus/access";
import { removeFromInternship } from "@/lib/campus/pipeline";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";

export const runtime = "nodejs";

/** Remove a student from this internship (not a ban). Body: { reason? }. Coordinator and up. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ entityId: string; applicationId: string }> }) {
    const { entityId, applicationId } = await params;
    const access = await requireCampusRole(entityId, "coordinator");
    if (isResponse(access)) return access;
    const limited = await limitCampusWrite(access.employer._id);
    if (limited) return limited;
    const body = await request.json().catch(() => null);
    const r = await removeFromInternship(access.entity, applicationId, { id: access.employer._id, name: access.employer.name }, stripHtml(typeof body?.reason === "string" ? body.reason : ""));
    return r.ok ? NextResponse.json({ success: true, data: { status: r.status } }) : failure(r);
}
