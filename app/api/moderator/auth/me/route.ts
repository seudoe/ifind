import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function GET() {
    try {
        const session = await getModSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Not authenticated" },
                { status: 401 },
            );
        }

        await connectDB();
        const moderator = await Moderator.findById(session.moderatorId)
            .select("-password")
            .lean();

        if (!moderator) {
            return NextResponse.json(
                { success: false, error: "Moderator not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
            data: JSON.parse(JSON.stringify(moderator)),
        });
    } catch (error) {
        console.error("[moderator/auth/me]", error);
        return NextResponse.json(
            { success: false, error: "Unable to load moderator" },
            { status: 500 },
        );
    }
}
