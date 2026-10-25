import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { isAnalyzeKind, modelFor, type AnalyzeKind } from "@/lib/moderator/analyze";
import { escapeRegex } from "@/lib/validate";

export const runtime = "nodejs";

const STATUSES = ["auto_approved", "pending_review", "auto_rejected", "manually_approved", "manually_rejected"];

/** Analyze tab list: every internship in one of the three collections, newest first, with its moderation verdict. */
export async function GET(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

        const sp = request.nextUrl.searchParams;
        const kind: AnalyzeKind = isAnalyzeKind(sp.get("kind")) ? (sp.get("kind") as AnalyzeKind) : "live";
        const status = sp.get("status") ?? "";
        const search = (sp.get("search") ?? "").trim().slice(0, 80);
        const page = Math.max(parseInt(sp.get("page") ?? "1", 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 100);

        const query: Record<string, unknown> = {};
        if (STATUSES.includes(status)) query["moderation.status"] = status;
        if (kind === "employer") query.status = { $ne: "draft" }; // drafts are never moderated
        if (search) {
            const rx = new RegExp(escapeRegex(search), "i");
            query.$or = [{ name: rx }, { company: rx }];
        }

        await connectDB();
        const Model = modelFor(kind);
        const [total, rows] = await Promise.all([
            Model.countDocuments(query),
            Model.find(query)
                .select("name company source isActive datePublished createdAt moderation.status moderation.score moderation.source")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
        ]);

        return NextResponse.json({
            success: true,
            data: rows.map((r) => ({ ...r, kind })),
            total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1),
        });
    } catch (error) {
        console.error("[moderator/analyze GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
