import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { limitCampusWrite, campusPostingBlocked, requireCampusRole } from "@/lib/campus/access";
import { deleteEvent, eventSchema, updateEvent } from "@/lib/campus/events";
import { failure } from "@/lib/campus/studentAuth";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";
import { zodMessage } from "@/lib/employer/validation";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import CampusEvent from "@/models/CampusEvent";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string; eventId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
    const { entityId, eventId } = await params;
    const access = await requireCampusRole(entityId, "viewer");
    if (isResponse(access)) return access;
    const doc = mongoose.isValidObjectId(eventId) ? await CampusEvent.findOne({ _id: eventId, entityId: access.entity._id }).lean() : null;
    return doc ? NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(doc)) }) : NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
}

/** Full replace. Changing the time, venue, link or mode of an announced event tells its audience once, with what changed. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const { entityId, eventId } = await params;
        const access = await requireCampusRole(entityId, "coordinator");
        if (isResponse(access)) return access;
        const blocked = campusPostingBlocked(access.entity);
        if (blocked) return blocked;
        const limited = await hit("campus:event-write", String(access.employer._id), RULES.employerWrite);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);
        const parsed = eventSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const r = await updateEvent(access.entity, eventId, stripHtml(parsed.data));
        return r.ok ? NextResponse.json({ success: true, data: { ...JSON.parse(JSON.stringify(r.event.toObject())), notified: r.notified } }) : failure(r);
    } catch (error) {
        console.error("[employer/campus/event PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to save the event" }, { status: 500 });
    }
}

/** Only events nobody was told about can be deleted; anything else is cancelled. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    const { entityId, eventId } = await params;
    const access = await requireCampusRole(entityId, "coordinator");
    if (isResponse(access)) return access;
    const limited = await limitCampusWrite(access.employer._id);
    if (limited) return limited;
    const r = await deleteEvent(access.entity._id, eventId);
    return r.ok ? NextResponse.json({ success: true }) : failure(r);
}
