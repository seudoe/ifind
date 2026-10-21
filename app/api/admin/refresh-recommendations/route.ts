/**
 * Admin API: Refresh Recommendations
 *
 * Sends approved-but-unvectorized internships to the vectoriser, then asks it to run every student (or only
 * `userIds`) through the whole HNSW graph. The recommendation pass runs in the vectoriser; this returns once queued.
 * Body (optional): { userIds?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshRecommendations } from "@/lib/internship-vectorizer";

import { requireVerifiedModerator } from "@/lib/moderatorAuth";

export const runtime = "nodejs";
export const maxDuration = 300; // vectorizing pending internships can take a while on a cold vectoriser

export async function POST(request: NextRequest) {
  // Expensive, platform-wide operation: moderators only.
  const auth = await requireVerifiedModerator();
  if (auth instanceof NextResponse) return auth;

  try {
    const { userIds } = await request.json().catch(() => ({}));
    const result = await refreshRecommendations(Array.isArray(userIds) ? userIds.map(String) : undefined);
    return NextResponse.json({
      success: result.recommendationsQueued,
      message: result.recommendationsQueued ? "Recommendation refresh queued in the vectoriser" : "Vectoriser unreachable",
      ...result,
    }, { status: result.recommendationsQueued ? 200 : 502 });
  } catch (error) {
    console.error("[admin/refresh-recommendations] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to refresh recommendations" }, { status: 500 });
  }
}
