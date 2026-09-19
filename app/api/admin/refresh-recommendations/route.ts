/**
 * Admin API: Refresh Recommendations
 * 
 * Trigger background refresh of recommendations for active users.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRefreshManager } from "@/lib/recommendation/background-refresh";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userIds } = body;

    const refreshManager = getRefreshManager();

    if (refreshManager.isRefreshRunning()) {
      return NextResponse.json(
        {
          success: false,
          error: "Refresh already in progress",
        },
        { status: 409 }
      );
    }

    console.log("[admin/refresh-recommendations] Starting background refresh");

    let result;
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Refresh specific users
      result = await refreshManager.refreshSpecificUsers(userIds);
    } else {
      // Refresh all active users
      result = await refreshManager.refreshActiveUsers();
    }

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Refreshed recommendations for ${result.successfulRefreshes} users`
        : "Refresh failed",
      processedUsers: result.processedUsers,
      successfulRefreshes: result.successfulRefreshes,
      failedRefreshes: result.failedRefreshes,
      skippedUsers: result.skippedUsers,
      durationMs: result.durationMs,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[admin/refresh-recommendations] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refresh recommendations",
      },
      { status: 500 }
    );
  }
}
