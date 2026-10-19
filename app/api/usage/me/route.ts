import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import User from "@/models/User";
import { getDaily } from "@/lib/usage/quota";
import { getUsageSettings } from "@/lib/usage/settings";
import { nextIstMidnight } from "@/lib/usage/time";

export const runtime = "nodejs";

/** GET /api/usage/me: today's AI credits for the signed-in student (shown next to the billed features). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const [settings, user, today] = await Promise.all([
      getUsageSettings(),
      User.findById(session.userId, { dailyCreditLimit: 1 }).lean(),
      getDaily("user", session.userId),
    ]);
    const limit = typeof user?.dailyCreditLimit === "number" ? user.dailyCreditLimit : settings.defaultDailyCredits;
    const used = today?.creditsUsed ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        limit,
        used,
        remaining: Math.max(0, limit - used),
        resetsAt: nextIstMidnight().toISOString(),
        featureCredits: settings.featureCredits,
      },
    });
  } catch (error) {
    console.error("[usage/me GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
