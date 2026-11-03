import { NextRequest, NextResponse } from "next/server";
import { listCampusesForModeration } from "@/lib/campus/moderation";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";

export const runtime = "nodejs";

/** Campuses with report counts, most reported first. ?search= &status=none|restricted|banned|reported &page= &limit= */
export async function GET(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        const sp = request.nextUrl.searchParams;
        await connectDB();
        const out = await listCampusesForModeration({ search: sp.get("search") ?? "", status: sp.get("status") ?? "", page: Number(sp.get("page")) || 1, limit: Number(sp.get("limit")) || 20 });
        return NextResponse.json({ success: true, ...out });
    } catch (error) {
        console.error("[moderator/campuses GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
