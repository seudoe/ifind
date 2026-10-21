import { isObjectId } from "@/lib/validate";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import User from "@/models/User";
import BanEvent from "@/models/BanEvent";
import { forgetBanCache } from "@/lib/banCheck";
import { getUserSignals } from "@/lib/usage/signals";

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
        if (!isObjectId(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        const body = await request.json();
        const action = typeof body.action === "string" ? body.action : "";
        const reason = typeof body.reason === "string" ? body.reason : "";

        if (action === "set-limit") {
            // Per-user override of the daily credit pool; null puts the user back on the site default.
            const raw = body.limit;
            const limit = raw === null ? null : Number(raw);
            if (limit !== null && (!Number.isFinite(limit) || limit < 0 || limit > 100000)) {
                return NextResponse.json(
                    { success: false, error: "limit must be a number from 0 to 100000, or null for the default." },
                    { status: 400 },
                );
            }
            await connectDB();
            const result = await User.updateOne({ _id: id }, { $set: { dailyCreditLimit: limit === null ? null : Math.floor(limit) } });
            if (!result.matchedCount) {
                return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            }
            return NextResponse.json({ success: true }, { status: 200 });
        }

        // 400 for unrecognized action
        if (action !== "ban" && action !== "unban") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Unrecognized action "${action}". Must be "ban", "unban" or "set-limit".`,
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

        forgetBanCache(id);

        // History: who did it, why, and what the user's numbers looked like at that moment.
        try {
            await BanEvent.create({
                userId: id,
                action,
                reason: action === "ban" ? reason.trim() : reason.trim() || null,
                moderatorId,
                moderatorName: session.name,
                signals: await getUserSignals(id),
                at: now,
            });
        } catch (historyError) {
            console.error("[moderator/users/[id] PATCH] could not write ban history", historyError);
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
