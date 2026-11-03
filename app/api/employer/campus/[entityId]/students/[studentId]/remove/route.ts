import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { removeStudentFromCampus } from "@/lib/campus/pipeline";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";

export const runtime = "nodejs";

/** Remove a student from the campus. Body: { reason? }. Coordinator and up. They can rejoin with the code; this is not a ban. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ entityId: string; studentId: string }> }) {
    const { entityId, studentId } = await params;
    const access = await requireCampusRole(entityId, "coordinator");
    if (isResponse(access)) return access;
    const body = await request.json().catch(() => null);
    const r = await removeStudentFromCampus(access.entity, studentId, { id: access.employer._id, name: access.employer.name }, stripHtml(typeof body?.reason === "string" ? body.reason : ""));
    return r.ok ? NextResponse.json({ success: true, data: { removed: r.removed } }) : failure(r);
}
