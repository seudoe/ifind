import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { bulkChangeStatus } from "@/lib/campus/pipeline";
import { isResponse } from "@/lib/employer/access";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

const BULK = ["shortlisted", "in_process", "offered", "rejected"] as const;

/** Body: { ids: string[] (max 200), status }. Each application is judged on its own transition; failures are listed. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ entityId: string }> }) {
    try {
        const access = await requireCampusRole((await params).entityId, "coordinator");
        if (isResponse(access)) return access;
        const limited = await hit("campus:applicant-write", String(access.employer._id), RULES.employerWrite);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);
        const body = await request.json().catch(() => null);
        const ids: unknown = body?.ids;
        if (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every((x) => typeof x === "string")) {
            return NextResponse.json({ success: false, error: "Send 1 to 200 application ids" }, { status: 400 });
        }
        if (!(BULK as readonly string[]).includes(body.status)) return NextResponse.json({ success: false, error: "Unsupported status" }, { status: 400 });
        const data = await bulkChangeStatus(access.entity, ids as string[], body.status, { id: access.employer._id, name: access.employer.name });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("[employer/campus/bulk-status]", error);
        return NextResponse.json({ success: false, error: "Bulk update failed" }, { status: 500 });
    }
}
