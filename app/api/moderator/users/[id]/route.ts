import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import User from "@/models/User";

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

        const { id } = await params;

        const body = await request.json();
        const action = typeof body.action === "string" ? body.action : "";
        const reason = typeof body.reason === "string" ? body.reason : "";

        // 400 for unrecognized action
        if (action !== "ban" && action !== "unban") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Unrecognized action "${action}". Must be "ban" or "unban".`,
                },
                { status: 400 },
            );
        }

        // 400 if ban action has missing or whitespace-only reason
        if (action === "ban" && !reason.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    error: "A non-empty reason is required when banning a user.",
                },
                { status: 400 },
            );
        }

        await connectDB();

        // 404 if user not found
        const user = await User.findById(id).select("_id");
        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 },
            );
        }

        const now = new Date();
        const moderatorId = session.moderatorId;

        if (action === "ban") {
            // Atomically set all four ban fields
            await User.updateOne(
                { _id: id },
                {
                    $set: {
                        isBanned: true,
                        bannedReason: reason.trim(),
                        bannedBy: moderatorId,
                        bannedAt: now,
                    },
                },
            );
        } else {
            // action === "unban" — atomically clear all four ban fields
            await User.updateOne(
                { _id: id },
                {
                    $set: {
                        isBanned: false,
                        bannedReason: null,
                        bannedBy: null,
                        bannedAt: null,
                    },
                },
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("[moderator/users/[id] PATCH]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
