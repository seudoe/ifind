import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { EmployerNotification as Notification } from "@/models/Notification";
import type { AppNotification } from "@/types/employer";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const mine = { recipientType: "employer" as const, recipientId: employer._id };
        const unread = await Notification.countDocuments({ ...mine, readAt: null });
        if (request.nextUrl.searchParams.get("countOnly")) {
            return NextResponse.json({ success: true, data: { unread } });
        }
        const rows = await Notification.find(mine).sort({ createdAt: -1 }).limit(100).lean();
        const items: AppNotification[] = rows.map((n) => ({
            _id: String(n._id),
            recipientType: n.recipientType,
            recipientId: String(n.recipientId),
            type: n.type,
            title: n.title,
            body: n.body ?? null,
            link: n.link ?? null,
            companyId: n.companyId ? String(n.companyId) : null,
            readAt: n.readAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
        }));
        return NextResponse.json({ success: true, data: { items, unread } });
    } catch (error) {
        console.error("[employer/notifications GET]", error);
        return NextResponse.json({ success: false, error: "Unable to load notifications" }, { status: 500 });
    }
}

/** Body: { id } marks one read, { all: true } marks all read. */
export async function PATCH(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const body = await request.json();
        const filter: Record<string, unknown> = { recipientType: "employer", recipientId: employer._id, readAt: null };
        if (body.all !== true) {
            if (typeof body.id !== "string" || !mongoose.isValidObjectId(body.id)) {
                return NextResponse.json({ success: false, error: "id or all required" }, { status: 400 });
            }
            filter._id = body.id;
        }
        await Notification.updateMany(filter, { $set: { readAt: new Date() } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/notifications PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to update notifications" }, { status: 500 });
    }
}
