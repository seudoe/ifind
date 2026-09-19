/**
 * Admin API: Cleanup Expired Cache
 * 
 * Remove all expired cache entries.
 */

import { NextResponse } from "next/server";
import { getRecommendationCache } from "@/lib/recommendation";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cache = getRecommendationCache();
    const cleaned = await cache.cleanupExpired();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleaned} expired cache entries`,
      cleaned,
    });
  } catch (error) {
    console.error("[admin/cleanup-cache] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cleanup expired cache",
      },
      { status: 500 }
    );
  }
}
