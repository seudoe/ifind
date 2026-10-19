import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import User from "@/models/User";
import UsageDaily from "@/models/UsageDaily";
import UsageSettings from "@/models/UsageSettings";
import { FEATURE_CREDITS } from "@/lib/usage/config";
import { clearUsageSettingsCache, getUsageSettings } from "@/lib/usage/settings";
import { istDay } from "@/lib/usage/time";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;

/** GET /api/moderator/usage: spend per day, top users by cost, system spend against the budget, and the settings. */
export async function GET() {
  try {
    const session = await getModSession();
    if (!session || !session.isVerified) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const settings = await getUsageSettings();
    const days = Array.from({ length: 14 }, (_, i) => istDay(new Date(Date.now() - i * DAY_MS)));
    const today = days[0];
    const week = days.slice(0, 7);

    const [perDay, systemDocs, top] = await Promise.all([
      UsageDaily.aggregate([
        { $match: { scope: "user", day: { $in: days } } },
        { $group: { _id: "$day", costUsd: { $sum: "$costUsd" }, creditsUsed: { $sum: "$creditsUsed" }, requests: { $sum: "$requests" }, blocked: { $sum: "$blocked" }, activeUsers: { $sum: 1 } } },
      ]),
      UsageDaily.find({ scope: "system", day: { $in: days } }).lean(),
      UsageDaily.aggregate([
        { $match: { scope: "user", day: { $in: week } } },
        { $group: { _id: "$subject", costUsd: { $sum: "$costUsd" }, creditsUsed: { $sum: "$creditsUsed" }, requests: { $sum: "$requests" }, blocked: { $sum: "$blocked" }, daysHitLimit: { $sum: { $cond: ["$hitLimit", 1, 0] } } } },
        { $sort: { costUsd: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const users = await User.find({ _id: { $in: top.map((t) => t._id) } }, { name: 1, username: 1, email: 1 }).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const systemAll = (day: string) => systemDocs.find((d) => d.day === day && d.subject === "all");
    const todaySystem = systemAll(today);

    return NextResponse.json({
      success: true,
      data: {
        settings: { ...settings, defaultFeatureCredits: FEATURE_CREDITS },
        systemToday: {
          costUsd: todaySystem?.costUsd ?? 0,
          budgetUsd: settings.systemDailyBudgetUsd,
          budgetExceeded: Boolean((todaySystem as { budgetExceeded?: boolean } | undefined)?.budgetExceeded),
          bySource: systemDocs
            .filter((d) => d.day === today && d.subject !== "all")
            .map((d) => ({ source: d.subject, costUsd: d.costUsd, llmCalls: d.llmCalls, tokensIn: d.tokensIn, tokensOut: d.tokensOut })),
        },
        perDay: days.map((day) => {
          const users = perDay.find((d) => d._id === day);
          return {
            day,
            usersCostUsd: users?.costUsd ?? 0,
            systemCostUsd: systemAll(day)?.costUsd ?? 0,
            requests: users?.requests ?? 0,
            blocked: users?.blocked ?? 0,
            activeUsers: users?.activeUsers ?? 0,
          };
        }),
        topUsers: top.map((t) => {
          const u = byId.get(String(t._id));
          return { userId: String(t._id), name: u?.name ?? "(deleted)", username: u?.username ?? "", costUsd: t.costUsd, creditsUsed: t.creditsUsed, requests: t.requests, blocked: t.blocked, daysHitLimit: t.daysHitLimit };
        }),
      },
    });
  } catch (error) {
    console.error("[moderator/usage GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

const numberIn = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;

/** PATCH /api/moderator/usage: change the default daily credits, the system budget, feature costs or flag thresholds. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getModSession();
    if (!session || !session.isVerified) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const set: Record<string, unknown> = {};

    if (body.defaultDailyCredits !== undefined) {
      const v = numberIn(body.defaultDailyCredits, 0, 100000);
      if (v === undefined) return NextResponse.json({ success: false, error: "defaultDailyCredits must be 0 to 100000" }, { status: 400 });
      set.defaultDailyCredits = Math.floor(v);
    }
    if (body.systemDailyBudgetUsd !== undefined) {
      const v = numberIn(body.systemDailyBudgetUsd, 0, 100000);
      if (v === undefined) return NextResponse.json({ success: false, error: "systemDailyBudgetUsd must be 0 to 100000" }, { status: 400 });
      set.systemDailyBudgetUsd = v;
    }
    for (const field of ["featureCredits", "flagThresholds"] as const) {
      if (body[field] === undefined) continue;
      if (typeof body[field] !== "object" || body[field] === null || Array.isArray(body[field])) {
        return NextResponse.json({ success: false, error: `${field} must be an object` }, { status: 400 });
      }
      for (const [key, value] of Object.entries(body[field])) {
        const v = numberIn(value, 0, 100000);
        if (v === undefined) return NextResponse.json({ success: false, error: `${field}.${key} must be a number from 0 to 100000` }, { status: 400 });
        set[`${field}.${key}`] = v;
      }
    }
    if (!Object.keys(set).length) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();
    await UsageSettings.updateOne({ _id: "global" }, { $set: { ...set, updatedAt: new Date(), updatedBy: session.moderatorId } }, { upsert: true });
    clearUsageSettingsCache();
    return NextResponse.json({ success: true, data: await getUsageSettings() });
  } catch (error) {
    console.error("[moderator/usage PATCH]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
