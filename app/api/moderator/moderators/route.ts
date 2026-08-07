import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function GET() {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            );
        }

        await connectDB();

        // Select required fields; password is excluded by default (select: false on schema)
        // Sort: unverified first (isVerified ascending: false < true), then createdAt descending
        const moderators = await Moderator.find()
            .select(
                "name email isVerified verifiedBy verifiedAt createdAt priority isBanned bannedBy bannedAt bannedReason",
            )
            .populate("verifiedBy", "name")
            .sort({ isVerified: 1, createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: moderators });
    } catch (error) {
        console.error("[moderator/moderators GET]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
