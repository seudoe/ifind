import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function PATCH(
    _request: NextRequest,
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

        // 400 if attempting self-verification
        if (targetId === session.moderatorId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Moderators cannot verify themselves",
                },
                { status: 400 },
            );
        }

        await connectDB();

        // 404 if target moderator does not exist
        const target =
            await Moderator.findById(targetId).select("_id isVerified");
        if (!target) {
            return NextResponse.json(
                { success: false, error: "Moderator not found" },
                { status: 404 },
            );
        }

        // 409 if already verified
        if (target.isVerified) {
            return NextResponse.json(
                { success: false, error: "Moderator is already verified" },
                { status: 409 },
            );
        }

        // Atomically write all three verification fields
        await Moderator.updateOne(
            { _id: targetId },
            {
                $set: {
                    isVerified: true,
                    verifiedBy: session.moderatorId,
                    verifiedAt: new Date(),
                },
            },
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("[moderator/moderators/[id]/verify PATCH]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
