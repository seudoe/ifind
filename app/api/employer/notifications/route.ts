import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { employerFeed, employerUnreadCount, markEmployerRead } from "@/lib/employer/notifications";

export const runtime = "nodejs";

/** The employer's inbox: personal notifications plus every notification of the companies they belong to. */
export async function GET(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        if (request.nextUrl.searchParams.get("countOnly")) {
            return NextResponse.json({ success: true, data: { unread: await employerUnreadCount(employer._id) } });
        }
        return NextResponse.json({ success: true, data: await employerFeed(employer._id) });
    } catch (error) {
        console.error("[employer/notifications GET]", error);
        return NextResponse.json({ success: false, error: "Unable to load notifications" }, { status: 500 });
    }
}

/** Body: { id, scope: "personal" | "company" } marks one read, { all: true } marks everything read (for this person only). */
export async function PATCH(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const body = await request.json().catch(() => ({}));
        if (body.all === true) {
            await markEmployerRead(employer._id, { all: true });
        } else {
            if (typeof body.id !== "string" || !mongoose.isValidObjectId(body.id) || (body.scope !== "personal" && body.scope !== "company")) {
                return NextResponse.json({ success: false, error: "id and scope, or all, required" }, { status: 400 });
            }
            await markEmployerRead(employer._id, { id: body.id, scope: body.scope });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/notifications PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to update notifications" }, { status: 500 });
    }
}
