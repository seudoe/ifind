/**
 * Admin API: Cache Statistics
 * 
 * Get statistics about the recommendation cache.
 */

import { NextResponse } from "next/server";
import { getRecommendationCache } from "@/lib/recommendation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cache = getRecommendationCache();
    const stats = await cache.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[admin/cache-stats] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get cache statistics",
      },
      { status: 500 }
    );
  }
}
