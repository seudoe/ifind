import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { campusApplicantDetail } from "@/lib/campus/applicants";
import { changeCampusStatus, setRating, setRoundResult } from "@/lib/campus/pipeline";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import { CAMPUS_APPLICATION_STATUSES, CAMPUS_ROUND_RESULTS, type CampusApplicationStatus } from "@/types/campus";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string; applicationId: string }> };

/** Full applicant view, including staff notes and rating. Viewer and up. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    const { entityId, applicationId } = await params;
    const access = await requireCampusRole(entityId, "viewer");
    if (isResponse(access)) return access;
    const data = await campusApplicantDetail(access.entity._id, applicationId);
    return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
}

/** Body: { status?, note?, rating?, round?: { name, result, note? } }. Coordinator and up. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const { entityId, applicationId } = await params;
        const access = await requireCampusRole(entityId, "coordinator");
        if (isResponse(access)) return access;
        const limited = await hit("campus:applicant-write", String(access.employer._id), RULES.employerWrite);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
        const actor = { id: access.employer._id, name: access.employer.name };

        if (body.rating !== undefined) {
            const r = await setRating(access.entity._id, applicationId, body.rating);
            if (!r.ok) return failure(r);
        }
        if (body.round) {
            const ok = typeof body.round.name === "string" && CAMPUS_ROUND_RESULTS.includes(body.round.result);
            if (!ok) return NextResponse.json({ success: false, error: "A round name and result are required" }, { status: 400 });
            const r = await setRoundResult(access.entity, applicationId, { name: body.round.name, result: body.round.result, note: typeof body.round.note === "string" ? body.round.note : null });
            if (!r.ok) return failure(r);
        }
        if (body.status !== undefined) {
            if (!(CAMPUS_APPLICATION_STATUSES as readonly string[]).includes(body.status)) return NextResponse.json({ success: false, error: "Unknown status" }, { status: 400 });
            const r = await changeCampusStatus(access.entity, applicationId, body.status as CampusApplicationStatus, actor, typeof body.note === "string" ? body.note : null);
            if (!r.ok) return failure(r);
        }
        return NextResponse.json({ success: true, data: await campusApplicantDetail(access.entity._id, applicationId) });
    } catch (error) {
        console.error("[employer/campus/application PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to update the application" }, { status: 500 });
    }
}
