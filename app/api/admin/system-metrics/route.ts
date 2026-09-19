/**
 * Admin API: System Metrics
 * 
 * Get comprehensive metrics about the recommendation system.
 */

import { NextResponse } from "next/server";
import { getSystemMetrics } from "@/lib/recommendation/monitoring";

export const runtime = "nodejs";

export async function GET() {
  try {
    const metrics = await getSystemMetrics();

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("[admin/system-metrics] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get system metrics",
      },
      { status: 500 }
    );
  }
}
