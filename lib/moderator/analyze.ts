import type { Model } from "mongoose";
import Internship, { StagedInternship, type IInternship } from "@/models/Internship";
import PlatformInternship from "@/models/PlatformInternship";
import { internscraperUrl } from "@/lib/services";

/**
 * The three places an internship can live, as the moderator Analyze tab sees them:
 *   live      "internships"                   approved scraped listings (vectorized, students can see them)
 *   staged    "internships.mod-unvectorised"  scraped listings waiting for / rejected by moderation
 *   employer  "internships.this-platform"     posted by employers on iFind
 */
export const ANALYZE_KINDS = ["live", "staged", "employer"] as const;
export type AnalyzeKind = (typeof ANALYZE_KINDS)[number];

export const isAnalyzeKind = (v: unknown): v is AnalyzeKind => ANALYZE_KINDS.includes(v as AnalyzeKind);

export const modelFor = (kind: AnalyzeKind): Model<IInternship> =>
    (kind === "live" ? Internship : kind === "staged" ? StagedInternship : PlatformInternship) as unknown as Model<IInternship>;

/** Everything except the (large) embedding vectors. */
export const NO_VECTORS = "-tfidf_vector -bert_vector";

export interface PipelineStage { stage: string; status: string | null; detail?: string | null; seconds?: number | null; rules?: string[] }

export interface PipelineResult {
    source: string;
    detectorFailed: boolean;
    detectorError?: string | null;
    detectorSeconds?: number | null;
    stages: PipelineStage[];
    result: {
        outcome: "scored" | "rejected" | "error";
        reason?: string | null;
        moderationStatus?: string;
        score?: number;
        decision?: "clear" | "review" | "block";
        confidence?: number;
        flags?: string[];
        triggeredRules?: string[];
        lowConfidence?: boolean;
        hardDisqualified?: boolean;
        rejectionReason?: string | null;
        scamDetails?: {
            score: number; decision: "clear" | "review" | "block"; confidence: number; explanationSummary: string;
            scamFlags: string[]; evaluatedAt?: string | null; riskBreakdown?: Record<string, number | null> | null;
        };
        document?: Record<string, unknown>;
    };
}

/** Sends one stored internship through internScraper's read-only POST /analyze. Throws a readable Error on failure. */
export async function runPipeline(doc: Record<string, unknown>, source: string): Promise<PipelineResult> {
    const base = internscraperUrl();
    if (!base) throw new Error("INTERNSCRAPER_URL is not configured");
    const res = await fetch(`${base}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.INTERNSCRAPER_API_KEY ? { "x-api-key": process.env.INTERNSCRAPER_API_KEY } : {}) },
        body: JSON.stringify({ source, internship: doc }),
        signal: AbortSignal.timeout(60_000), // the detector loads its models on the first call after a cold start
    });
    if (!res.ok) {
        const text = (await res.text().catch(() => "")).slice(0, 200);
        throw new Error(res.status === 404 ? "The internScraper service does not have /analyze yet — redeploy it" : `internScraper responded ${res.status}${text ? `: ${text}` : ""}`);
    }
    return (await res.json()) as PipelineResult;
}
