import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { banStudent, listBlacklist, unbanStudent } from "@/lib/campus/pipeline";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string }> };

/** Viewer and up: who is barred, why, by whom. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    return NextResponse.json({ success: true, data: await listBlacklist(access.entity._id) });
}

/** Ban from future internships of this campus. Body: { studentId, reason, removeOpen? }. Coordinator and up. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "coordinator");
        if (isResponse(access)) return access;
        const limited = await hit("campus:ban", String(access.employer._id), RULES.employerModeration);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);
        const body = await request.json().catch(() => null);
        const r = await banStudent(access.entity, String(body?.studentId ?? ""), { id: access.employer._id, name: access.employer.name }, stripHtml(String(body?.reason ?? "")), body?.removeOpen === true);
        return r.ok ? NextResponse.json({ success: true, data: { removed: r.removed } }, { status: 201 }) : failure(r);
    } catch (error) {
        console.error("[employer/campus/blacklist POST]", error);
        return NextResponse.json({ success: false, error: "Unable to bar this student" }, { status: 500 });
    }
}

/** Unban (?studentId=). Coordinator and up. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "coordinator");
    if (isResponse(access)) return access;
    const r = await unbanStudent(access.entity, request.nextUrl.searchParams.get("studentId") ?? "", { id: access.employer._id, name: access.employer.name });
    return r.ok ? NextResponse.json({ success: true }) : failure(r);
}
