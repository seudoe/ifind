import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { listCampusStudents } from "@/lib/campus/students";
import { isResponse } from "@/lib/employer/access";

export const runtime = "nodejs";

/** Viewer and up. ?q= searches name, college ID, course, department or batch year. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entityId: string }> }) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    const sp = request.nextUrl.searchParams;
    const data = await listCampusStudents(access.entity._id, { q: sp.get("q") ?? "", page: Number(sp.get("page") ?? 1) || 1 });
    return NextResponse.json({ success: true, data: { ...data, uidLabel: access.entity.uidLabel } });
}
