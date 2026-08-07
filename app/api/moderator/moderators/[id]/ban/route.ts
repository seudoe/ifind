import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            );
        }

        const { id: targetId } = await params;

        if (targetId === session.moderatorId) {
            return NextResponse.json(
                { success: false, error: "You cannot ban yourself" },
                { status: 400 },
            );
        }

        const body = await request.json().catch(() => ({}));
        const reason = body.reason || null;

        await connectDB();

        const banner = await Moderator.findById(session.moderatorId).select("priority");
        if (!banner) {
            return NextResponse.json(
                { success: false, error: "Banner not found" },
                { status: 404 },
            );
        }

        const target = await Moderator.findById(targetId).select("priority isBanned");
        if (!target) {
            return NextResponse.json(
                { success: false, error: "Target moderator not found" },
                { status: 404 },
            );
        }

        // Priority check: smaller number = higher priority
        // You can only ban someone if your priority number is STRICTLY less than theirs
        if (banner.priority >= target.priority) {
            return NextResponse.json(
                { success: false, error: "You do not have a high enough priority to perform this action on this moderator." },
                { status: 403 },
            );
        }

        const isCurrentlyBanned = target.isBanned;

        // Toggle ban state
        if (isCurrentlyBanned) {
            // Unban
            await Moderator.updateOne(
                { _id: targetId },
                {
                    $set: {
                        isBanned: false,
                        bannedBy: null,
                        bannedAt: null,
                        bannedReason: null,
                    },
                },
            );
        } else {
            // Ban
            await Moderator.updateOne(
                { _id: targetId },
                {
                    $set: {
                        isBanned: true,
                        bannedBy: session.moderatorId,
                        bannedAt: new Date(),
                        bannedReason: reason,
                    },
                },
            );
        }

        return NextResponse.json({ success: true, isBanned: !isCurrentlyBanned }, { status: 200 });
    } catch (error) {
        console.error("[moderator/moderators/[id]/ban PATCH]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
