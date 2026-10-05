import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";

export const runtime = "nodejs";

// [id] is the scrape job id, or the run's _id for runs started from the CLI (no job id).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) throw new Error("Database connection not available");

        const or: Record<string, unknown>[] = [{ jobId: id }];
        if (mongoose.isValidObjectId(id)) or.push({ _id: new mongoose.Types.ObjectId(id) });
        const run = await db.collection("scrape.runs").findOne({ $or: or });
        if (!run) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: run });
    } catch (error) {
        console.error("[moderator/scrapes/[id] GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
