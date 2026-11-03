import { NextRequest, NextResponse } from "next/server";
import { campusPostingBlocked, requireCampusRole } from "@/lib/campus/access";
import { createEvent, eventSchema } from "@/lib/campus/events";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";
import { zodMessage } from "@/lib/employer/validation";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import CampusEvent from "@/models/CampusEvent";
import mongoose from "mongoose";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string }> };

/** Viewer and up. ?internshipId= limits to one internship's events; ?scope=campus to the campus-wide ones. */
export async function GET(request: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    const sp = request.nextUrl.searchParams;
    const filter: Record<string, unknown> = { entityId: access.entity._id };
    const internshipId = sp.get("internshipId");
    if (internshipId && mongoose.isValidObjectId(internshipId)) filter.internshipId = new mongoose.Types.ObjectId(internshipId);
    else if (sp.get("scope") === "campus") filter.internshipId = null;
    const docs = await CampusEvent.find(filter).sort({ startsAt: -1, createdAt: -1 }).limit(300).lean();
    return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(docs)) });
}

/** Creates an event and tells its audience (in-app now; email/SMS through the outbound channel). Coordinator and up. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "coordinator");
        if (isResponse(access)) return access;
        const blocked = campusPostingBlocked(access.entity);
        if (blocked) return blocked;
        const limited = await hit("campus:event-write", String(access.employer._id), RULES.employerWrite);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);

        const parsed = eventSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const r = await createEvent(access.entity, stripHtml(parsed.data), access.employer._id);
        return r.ok ? NextResponse.json({ success: true, data: { ...JSON.parse(JSON.stringify(r.event.toObject())), reach: r.reach } }, { status: 201 }) : failure(r);
    } catch (error) {
        console.error("[employer/campus/events POST]", error);
        return NextResponse.json({ success: false, error: "Unable to save the event" }, { status: 500 });
    }
}
