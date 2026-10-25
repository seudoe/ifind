import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { isAnalyzeKind, modelFor, NO_VECTORS, runPipeline } from "@/lib/moderator/analyze";
import { isObjectId } from "@/lib/validate";

export const runtime = "nodejs";

/**
 * Re-runs one internship through internScraper's pipeline (POST {INTERNSCRAPER_URL}/analyze, read-only there) and
 * returns every detail. Only the scam-detection fields are refreshed on our copy (moderation.score / flags /
 * scamDetails): the moderation STATUS never changes here, a moderator still decides with Approve / Reject.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
    try {
        const session = await getModSession();
        if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

        const { kind, id } = await params;
        if (!isAnalyzeKind(kind) || !isObjectId(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        await connectDB();
        const Model = modelFor(kind);
        const doc = await Model.findById(id).select(NO_VECTORS).lean<Record<string, unknown> & { moderation?: Record<string, unknown>; source?: string }>();
        if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        let analysis;
        try {
            analysis = await runPipeline(JSON.parse(JSON.stringify(doc)), String(doc.source ?? ""));
        } catch (err) {
            return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Pipeline unreachable" }, { status: 502 });
        }

        const { result } = analysis;
        let persisted = false;
        if (result.outcome === "scored" && result.scamDetails && !analysis.detectorFailed) {
            const sd = result.scamDetails;
            await Model.updateOne(
                { _id: id },
                {
                    $set: {
                        "moderation.score": result.score ?? sd.score,
                        "moderation.flags": result.flags ?? sd.scamFlags,
                        "moderation.scamDetails": {
                            score: sd.score,
                            decision: sd.decision,
                            confidence: sd.confidence,
                            explanationSummary: sd.explanationSummary,
                            scamFlags: sd.scamFlags ?? [],
                            evaluatedAt: sd.evaluatedAt ? new Date(sd.evaluatedAt) : new Date(),
                            riskBreakdown: sd.riskBreakdown ?? null,
                        },
                    },
                },
            );
            persisted = true;
        }

        return NextResponse.json({
            success: true,
            persisted,
            previous: { status: doc.moderation?.status ?? null, score: doc.moderation?.score ?? null },
            analysis,
        });
    } catch (error) {
        console.error("[moderator/analyze/rescan POST]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
