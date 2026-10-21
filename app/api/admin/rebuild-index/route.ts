/**
 * Admin API: Rebuild HNSW Index
 * 
 * Rebuilds the HNSW index from all active internships with vectors.
 * Requires a verified moderator session.
 */

import { NextResponse } from "next/server";
import { rebuildInternshipIndex } from "@/lib/internship-vectorizer";

import { requireVerifiedModerator } from "@/lib/moderatorAuth";

export const runtime = "nodejs";

export async function POST() {
  // Expensive, platform-wide operation: moderators only.
  const auth = await requireVerifiedModerator();
  if (auth instanceof NextResponse) return auth;

  try {
    console.log("[admin/rebuild-index] Starting HNSW index rebuild");

    const result = await rebuildInternshipIndex();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully rebuilt HNSW index with ${result.indexed} internships`,
        indexed: result.indexed,
        failed: result.failed,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to rebuild HNSW index",
          indexed: result.indexed,
          failed: result.failed,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[admin/rebuild-index] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during index rebuild",
      },
      { status: 500 }
    );
  }
}
