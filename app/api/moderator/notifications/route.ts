import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorNotification as Notification } from "@/models/Notification";
import type { AppNotification } from "@/types/employer";

export const runtime = "nodejs";

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** The signed-in moderator's own inbox. `?countOnly=1` returns just the unread count (sidebar badge). */
export async function GET(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session) return fail("Forbidden", 403);
        await connectDB();

        const mine = { recipientType: "moderator" as const, recipientId: new mongoose.Types.ObjectId(session.moderatorId) };
        const unread = await Notification.countDocuments({ ...mine, readAt: null });
        if (request.nextUrl.searchParams.get("countOnly")) return NextResponse.json({ success: true, data: { unread } });

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
            scope: "personal",
            readAt: n.readAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
        }));
        return NextResponse.json({ success: true, data: { items, unread } });
    } catch (error) {
        console.error("[moderator/notifications GET]", error);
        return fail("Unable to load notifications", 500);
    }
}

/** Body: { id } marks one read, { all: true } marks all read. */
export async function PATCH(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session) return fail("Forbidden", 403);
        const body = await request.json().catch(() => ({}));

        const filter: Record<string, unknown> = { recipientType: "moderator", recipientId: new mongoose.Types.ObjectId(session.moderatorId), readAt: null };
        if (body.all !== true) {
            if (typeof body.id !== "string" || !mongoose.isValidObjectId(body.id)) return fail("id or all required", 400);
            filter._id = body.id;
        }
        await connectDB();
        await Notification.updateMany(filter, { $set: { readAt: new Date() } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[moderator/notifications PATCH]", error);
        return fail("Unable to update notifications", 500);
    }
}
