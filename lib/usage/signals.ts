import { connectDB } from "@/lib/db";
import User from "@/models/User";
import UsageDaily from "@/models/UsageDaily";
import UsageLog from "@/models/UsageLog";
import { buildFlags, maxInRollingWindow, topCostStreak, type Flag, type UserMetrics } from "./flags";
import { getUsageSettings } from "./settings";
import { istDay } from "./time";

const DAY_MS = 86_400_000;

/** IST day keys for the last `n` days, newest first. */
function lastDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => istDay(new Date(Date.now() - i * DAY_MS)));
}

interface Totals {
  creditsUsed: number;
  requests: number;
  blocked: number;
  refunds: number;
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const zero = (): Totals => ({ creditsUsed: 0, requests: 0, blocked: 0, refunds: 0, llmCalls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 });

export interface UserSignals {
  account: {
    createdAt: Date;
    lastLoginAt: Date | null;
    loginCount: number;
    failedLogins24h: number;
    applications: number;
    maxApplicationsPerHour: number;
  };
  credits: { limit: number; isOverride: boolean; usedToday: number; remainingToday: number };
  usage: { today: Totals; last7: Totals; last30: Totals };
  byFeature30: Record<string, number>;
  history: Array<{ day: string; creditsUsed: number; requests: number; blocked: number; costUsd: number; hitLimit: boolean }>;
  behaviour: { maxRequestsPerMinute: number; maxRepeatedRequests: number; limitHitDays7: number; topCostStreak: number };
  flags: Flag[];
  recentRequests: Array<{ ts: Date; feature: string; status: string; credits: number; costUsd: number }>;
}

/** Usage, login and behaviour numbers for each user id, keyed by id. The flag rules run on these. */
async function collectMetrics(userIds: string[]) {
  await connectDB();
  const settings = await getUsageSettings();
  const t = settings.flagThresholds;
  const since24h = new Date(Date.now() - DAY_MS);
  const days30 = lastDays(30);
  const days7 = new Set(days30.slice(0, 7));

  const [users, dailyDocs, perMinute, repeats, recentDays] = await Promise.all([
    User.find(
      { _id: { $in: userIds } },
      { createdAt: 1, lastLoginAt: 1, loginCount: 1, failedLoginAttempts: 1, "appliedInternships.appliedAt": 1, dailyCreditLimit: 1 },
    ).lean(),
    UsageDaily.find({ scope: "user", subject: { $in: userIds }, day: { $gte: days30[days30.length - 1] } }).lean(),
    UsageLog.aggregate([
      { $match: { kind: "request", scope: "user", subject: { $in: userIds }, ts: { $gte: since24h } } },
      { $group: { _id: { subject: "$subject", minute: { $dateTrunc: { date: "$ts", unit: "minute" } } }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.subject", max: { $max: "$n" } } },
    ]),
    UsageLog.aggregate([
      { $match: { kind: "request", scope: "user", subject: { $in: userIds }, ts: { $gte: since24h }, reqHash: { $ne: null }, status: { $ne: "blocked" } } },
      { $group: { _id: { subject: "$subject", hash: "$reqHash" }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.subject", max: { $max: "$n" } } },
    ]),
    Promise.all(
      days30.slice(0, t.topCostDays).map(async (day) => ({
        costs: (await UsageDaily.find({ scope: "user", day }, { subject: 1, costUsd: 1 }).lean()).map((d) => ({ subject: d.subject, costUsd: d.costUsd })),
      })),
    ),
  ]);

  const burstBy = new Map(perMinute.map((r) => [String(r._id), Number(r.max)]));
  const repeatBy = new Map(repeats.map((r) => [String(r._id), Number(r.max)]));

  const result = new Map<string, { user: (typeof users)[number]; metrics: UserMetrics; docs: typeof dailyDocs; flags: Flag[] }>();
  for (const user of users) {
    const id = String(user._id);
    const docs = dailyDocs.filter((d) => d.subject === id);
    const applied = (user.appliedInternships ?? []).map((a) => new Date(a.appliedAt).getTime()).filter(Number.isFinite);
    const metrics: UserMetrics = {
      limitHitDays7: docs.filter((d) => days7.has(d.day) && d.hitLimit).length,
      maxRequestsPerMinute: burstBy.get(id) ?? 0,
      maxRepeatedRequests: repeatBy.get(id) ?? 0,
      failedLogins24h: (user.failedLoginAttempts ?? []).filter((d) => new Date(d).getTime() >= since24h.getTime()).length,
      maxApplicationsPerHour: maxInRollingWindow(applied, 3_600_000),
      topCostStreak: topCostStreak(recentDays, id, t.topCostPercent),
    };
    result.set(id, { user, metrics, docs, flags: buildFlags(metrics, t) });
  }
  return { result, settings, days30 };
}

/** Flags for a page of users in a few queries (the Users list badge). */
export async function getFlagsForUsers(userIds: string[]): Promise<Record<string, Flag[]>> {
  if (!userIds.length) return {};
  const { result } = await collectMetrics(userIds);
  return Object.fromEntries(userIds.map((id) => [id, result.get(id)?.flags ?? []]));
}

function sum(docs: Array<Partial<Totals>>): Totals {
  return docs.reduce<Totals>((t, d) => {
    for (const k of Object.keys(t) as Array<keyof Totals>) t[k] += Number(d[k] ?? 0);
    return t;
  }, zero());
}

/** Everything a moderator sees about one user before deciding on a ban. */
export async function getUserSignals(userId: string): Promise<UserSignals | null> {
  const { result, settings, days30 } = await collectMetrics([userId]);
  const entry = result.get(userId);
  if (!entry) return null;
  const { user, metrics, docs, flags } = entry;

  const today = days30[0];
  const days7 = new Set(days30.slice(0, 7));
  const todayTotals = sum(docs.filter((d) => d.day === today));
  const limit = typeof user.dailyCreditLimit === "number" ? user.dailyCreditLimit : settings.defaultDailyCredits;

  const byFeature30: Record<string, number> = {};
  for (const d of docs) {
    for (const [feature, n] of Object.entries((d.byFeature ?? {}) as Record<string, number>)) byFeature30[feature] = (byFeature30[feature] ?? 0) + Number(n);
  }

  const recent = await UsageLog.find({ kind: "request", scope: "user", subject: userId }, { ts: 1, feature: 1, status: 1, credits: 1, costUsd: 1 })
    .sort({ ts: -1 })
    .limit(25)
    .lean();

  return {
    account: {
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      loginCount: user.loginCount ?? 0,
      failedLogins24h: metrics.failedLogins24h,
      applications: (user.appliedInternships ?? []).length,
      maxApplicationsPerHour: metrics.maxApplicationsPerHour,
    },
    credits: {
      limit,
      isOverride: typeof user.dailyCreditLimit === "number",
      usedToday: todayTotals.creditsUsed,
      remainingToday: Math.max(0, limit - todayTotals.creditsUsed),
    },
    usage: { today: todayTotals, last7: sum(docs.filter((d) => days7.has(d.day))), last30: sum(docs) },
    byFeature30,
    history: [...docs]
      .sort((a, b) => b.day.localeCompare(a.day))
      .map((d) => ({ day: d.day, creditsUsed: d.creditsUsed, requests: d.requests, blocked: d.blocked, costUsd: d.costUsd, hitLimit: d.hitLimit })),
    behaviour: {
      maxRequestsPerMinute: metrics.maxRequestsPerMinute,
      maxRepeatedRequests: metrics.maxRepeatedRequests,
      limitHitDays7: metrics.limitHitDays7,
      topCostStreak: metrics.topCostStreak,
    },
    flags,
    recentRequests: recent.map((r) => ({ ts: r.ts, feature: r.feature, status: r.status, credits: r.credits ?? 0, costUsd: r.costUsd ?? 0 })),
  };
}
