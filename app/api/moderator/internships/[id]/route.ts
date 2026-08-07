import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Internship from "@/models/Internship";

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
        const rejectionReason =
            typeof body.rejectionReason === "string"
                ? body.rejectionReason
                : "";

        // 400 for unrecognized action
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Unrecognized action "${action}". Must be "approve" or "reject".`,
                },
                { status: 400 },
            );
        }

        // 400 if action is reject and rejectionReason is missing or empty or whitespace only
        if (action === "reject" && !rejectionReason.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    error: "A non-empty rejection reason is required when rejecting an internship.",
                },
                { status: 400 },
            );
        }

        await connectDB();

        // 404 if internship not found
        const internship = await Internship.findById(id);
        if (!internship) {
            return NextResponse.json(
                { success: false, error: "Internship not found" },
                { status: 404 },
            );
        }

        // 409 if action is approve and status is already manually_approved
        if (
            action === "approve" &&
            internship.moderation.status === "manually_approved"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Internship is already manually approved.",
                },
                { status: 409 },
            );
        }

        const now = new Date();
        const moderatorId = session.moderatorId;

        if (action === "approve") {
            // Use $set to update only moderation subdocument fields
            await Internship.updateOne(
                { _id: id },
                {
                    $set: {
                        "moderation.status": "manually_approved",
                        "moderation.reviewedBy": moderatorId,
                        "moderation.reviewedAt": now,
                    },
                },
            );
        } else {
            // action === "reject"
            // Use $set to update only moderation subdocument fields
            await Internship.updateOne(
                { _id: id },
                {
                    $set: {
                        "moderation.status": "manually_rejected",
                        "moderation.reviewedBy": moderatorId,
                        "moderation.reviewedAt": now,
                        "moderation.rejectionReason": rejectionReason.trim(),
                    },
                },
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("[moderator/internships/[id] PATCH]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
