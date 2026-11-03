import { NextRequest, NextResponse } from "next/server";
import { limitCampusWrite, requireCampusRole } from "@/lib/campus/access";
import { addNote } from "@/lib/campus/pipeline";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";

export const runtime = "nodejs";

/** Staff-only note on an applicant. Coordinator and up. Students never see it. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ entityId: string; applicationId: string }> }) {
    const { entityId, applicationId } = await params;
    const access = await requireCampusRole(entityId, "coordinator");
    if (isResponse(access)) return access;
    const limited = await limitCampusWrite(access.employer._id);
    if (limited) return limited;
    const body = await request.json().catch(() => null);
    const r = await addNote(access.entity._id, applicationId, access.employer._id, stripHtml(typeof body?.text === "string" ? body.text : ""));
    return r.ok ? NextResponse.json({ success: true }, { status: 201 }) : failure(r);
}
