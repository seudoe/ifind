import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";

export const runtime = "nodejs";

// GET /api/moderator/scrapes?days=30  → runs started in the last N days, newest first.
// Aggregation for charts happens client-side (lib/scrapeStats.ts); run counts are small.
export async function GET(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const rawDays = parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10);
        const days = isNaN(rawDays) || rawDays < 1 ? 30 : Math.min(rawDays, 365);
        const since = new Date(Date.now() - days * 86_400_000);

        await connectDB();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection not available");

        const runs = await db
            .collection("scrape.runs")
            .find({ startedAt: { $gte: since } })
            .sort({ startedAt: -1 })
            .limit(500)
            .toArray();

        return NextResponse.json({ success: true, days, data: runs });
    } catch (error) {
        console.error("[moderator/scrapes GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
