import UsageDaily from "@/models/UsageDaily";
import { connectDB } from "@/lib/db";
import { istDay } from "./time";

export interface Reservation {
  ok: boolean;
  /** Credits left after this reservation (or still left, if it was refused). */
  remaining: number;
  limit: number;
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Today's totals for one subject, or zeros. */
export async function getDaily(scope: "user" | "system", subject: string, day = istDay()) {
  await connectDB();
  return UsageDaily.findOne({ scope, subject, day }).lean();
}

/**
 * Takes `credits` from the user's pool for today in a single atomic update, so two simultaneous
 * requests can't both pass the limit. The filter only matches while there is room; when it doesn't match,
 * the upsert tries to insert, hits the unique (scope, subject, day) index and is treated as "limit reached".
 */
export async function reserveCredits(userId: string, credits: number, limit: number, feature: string): Promise<Reservation> {
  await connectDB();
  const day = istDay();
  const key = { scope: "user" as const, subject: userId, day };
  if (credits > limit) return { ...(await noteBlocked(userId, limit)), ok: false };
  try {
    const doc = await UsageDaily.findOneAndUpdate(
      { ...key, creditsUsed: { $lte: limit - credits } },
      {
        $inc: { creditsUsed: credits, requests: 1, [`byFeature.${feature}`]: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean();
    return { ok: true, remaining: Math.max(0, limit - (doc?.creditsUsed ?? credits)), limit };
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return noteBlocked(userId, limit);
  }
}

/** Gives credits back (provider failure, or a request that never reached the provider). */
export async function refundCredits(userId: string, credits: number): Promise<void> {
  await connectDB();
  await UsageDaily.updateOne(
    { scope: "user", subject: userId, day: istDay() },
    {
      $inc: { creditsUsed: -credits, refunds: 1 },
      $set: { updatedAt: new Date() },
    },
  );
}

/** Adds what the provider calls of one request cost to the user's daily totals. */
export async function addCallTotals(
  scope: "user" | "system",
  subject: string,
  totals: { calls: number; tokensIn: number; tokensOut: number; costUsd: number },
): Promise<void> {
  if (!totals.calls) return;
  await connectDB();
  await UsageDaily.updateOne(
    { scope, subject, day: istDay() },
    {
      $inc: { llmCalls: totals.calls, tokensIn: totals.tokensIn, tokensOut: totals.tokensOut, costUsd: totals.costUsd },
      $set: { updatedAt: new Date() },
    },
    { upsert: true },
  );
}

/** Counts a refused request against today's totals and reports what is left. */
async function noteBlocked(userId: string, limit: number): Promise<Reservation> {
  const key = { scope: "user" as const, subject: userId, day: istDay() };
  const doc = await UsageDaily.findOneAndUpdate(
    key,
    { $inc: { blocked: 1 }, $set: { hitLimit: true, updatedAt: new Date() } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return { ok: false, remaining: Math.max(0, limit - (doc?.creditsUsed ?? 0)), limit };
}
