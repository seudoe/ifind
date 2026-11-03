import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { listCampusApplicants } from "@/lib/campus/applicants";
import { isResponse } from "@/lib/employer/access";

export const runtime = "nodejs";

/** Viewer and up. ?internshipId= &status= &q= */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entityId: string }> }) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    const sp = request.nextUrl.searchParams;
    const data = await listCampusApplicants(access.entity._id, { internshipId: sp.get("internshipId") ?? undefined, status: sp.get("status") ?? undefined, q: sp.get("q") ?? undefined });
    return NextResponse.json({ success: true, data });
}
