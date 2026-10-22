import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession, type AuthSession } from "@/lib/auth";
import { log } from "@/lib/logger";
import { clientIp, hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import User from "@/models/User";
import UsageLog, { type IUsageLog } from "@/models/UsageLog";
import { runInUsageContext, type UsageContext } from "./context";
import type { FeatureKey } from "./config";
import { addCallTotals, overSystemBudget, refundCredits, reserveCredits, SYSTEM_SUBJECT, WEB_SOURCE } from "./quota";
import { getUsageSettings } from "./settings";
import { nextIstMidnight } from "./time";

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

const MAX_HASHED_BODY = 20_000;

async function requestHash(req: NextRequest): Promise<string> {
  let body = "";
  const type = req.headers.get("content-type") ?? "";
  const size = Number(req.headers.get("content-length") ?? 0);
  if (type.startsWith("multipart/") || size > MAX_HASHED_BODY) {
    body = `${type}:${size}`; // file uploads: don't buffer the file just to fingerprint it
  } else {
    try {
      body = await req.clone().text();
    } catch {
      // no readable body
    }
  }
  return createHash("sha256").update(`${req.nextUrl.pathname}\n${body}`).digest("hex").slice(0, 32);
}

/** Writes log documents without ever failing the request that produced them. */
async function writeLogs(docs: Partial<IUsageLog>[]): Promise<void> {
  try {
    await connectDB();
    await UsageLog.insertMany(docs, { ordered: false });
  } catch (error) {
    log.warn("usage", "could not write usage log", { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Wraps a billed route handler. It
 *  - rejects banned or signed-out users,
 *  - reserves the feature's credits from the user's daily pool (429 with the reset time when none are left),
 *  - collects every provider call the handler makes (tokens, estimated cost, latency) into the usage log,
 *  - refunds the credits when the provider failed (a 5xx or a throw) or the request never reached a provider.
 * Features that cost 0 credits skip the pool check but are still logged.
 */
export function withBilling<C = unknown>(
  feature: FeatureKey,
  handler: Handler<C>,
  deps: { getSession?: () => Promise<AuthSession | null> } = {},
): Handler<C> {
  const readSession = deps.getSession ?? getSession;
  return async (req, routeCtx) => {
    const session = await readSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const userId = session.userId;
    const requestId = randomUUID();
    const reqHash = await requestHash(req);
    const settings = await getUsageSettings();
    const credits = settings.featureCredits[feature] ?? 0;

    let remaining = settings.defaultDailyCredits;
    if (credits > 0) {
      // In front of the daily pool: a per-user burst cap and a per-address cap, so a script cannot spend a whole
      // day's credits in seconds or fan out across many accounts from one host.
      const burst = await hit("ai:user", userId, RULES.aiUserBurst);
      if (!burst.ok) return tooManyRequests(burst.retryAfter);
      const byIp = await hit("ai:ip", clientIp(req), RULES.aiIp);
      if (!byIp.ok) return tooManyRequests(byIp.retryAfter);

      // Site-wide ceiling (moderator setting "systemDailyBudgetUsd"): per-user limits cannot stop many accounts.
      if (await overSystemBudget(settings.systemDailyBudgetUsd)) {
        const resetsAt = nextIstMidnight();
        await writeLogs([{ kind: "request", scope: "user", subject: userId, feature, requestId, credits, status: "blocked", reqHash }]);
        log.warn("usage", "site-wide AI budget reached", { feature, budgetUsd: settings.systemDailyBudgetUsd });
        return NextResponse.json(
          { success: false, error: "AI features are paused for today. They return at 12:00 AM IST.", code: "SYSTEM_BUDGET", resetsAt: resetsAt.toISOString() },
          { status: 503, headers: { "Retry-After": String(Math.max(1, Math.ceil((resetsAt.getTime() - Date.now()) / 1000))) } },
        );
      }

      await connectDB();
      const user = await User.findById(userId, { dailyCreditLimit: 1 }).lean();
      const limit = typeof user?.dailyCreditLimit === "number" ? user.dailyCreditLimit : settings.defaultDailyCredits;
      const reservation = await reserveCredits(userId, credits, limit, feature);
      remaining = reservation.remaining;
      if (!reservation.ok) {
        const resetsAt = nextIstMidnight();
        await writeLogs([{ kind: "request", scope: "user", subject: userId, feature, requestId, credits, status: "blocked", reqHash }]);
        log.warn("usage", "daily limit reached", { userId, feature, limit });
        return NextResponse.json(
          {
            success: false,
            error: `You've used today's AI credits (${limit}). They reset at 12:00 AM IST.`,
            code: "DAILY_LIMIT",
            limit,
            remaining: 0,
            resetsAt: resetsAt.toISOString(),
          },
          { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((resetsAt.getTime() - Date.now()) / 1000))) } },
        );
      }
    }

    const ctx: UsageContext = { calls: [] };
    let response: Response | null = null;
    let thrown: unknown = null;
    try {
      response = await runInUsageContext(ctx, () => handler(req, routeCtx));
    } catch (error) {
      thrown = error;
    }

    // Bookkeeping below must never change what the user gets back.
    try {
      const failed = thrown !== null || (response?.status ?? 500) >= 500;
      // Give credits back when nothing was spent at a provider. A request that failed AFTER a provider call succeeded
      // already cost money, so it is not refunded (otherwise a request that errors late would be free).
      const paidCall = ctx.calls.some((c) => c.ok);
      const refund = credits > 0 && (ctx.calls.length === 0 || (failed && !paidCall));
      if (refund) await refundCredits(userId, credits);

      const totals = ctx.calls.reduce(
        (t, c) => ({ calls: t.calls + 1, tokensIn: t.tokensIn + c.tokensIn, tokensOut: t.tokensOut + c.tokensOut, costUsd: t.costUsd + c.costUsd }),
        { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 },
      );
      await addCallTotals("user", userId, totals);
      await addCallTotals("system", SYSTEM_SUBJECT, totals);
      await addCallTotals("system", WEB_SOURCE, totals);

      await writeLogs([
        {
          kind: "request",
          scope: "user",
          subject: userId,
          feature,
          requestId,
          credits,
          status: refund ? "refunded" : failed ? "error" : "ok",
          tokensIn: totals.tokensIn,
          tokensOut: totals.tokensOut,
          costUsd: totals.costUsd,
          reqHash,
          error: thrown ? String(thrown instanceof Error ? thrown.message : thrown).slice(0, 200) : null,
        },
        ...ctx.calls.map((c) => ({
          kind: "call" as const,
          scope: "user" as const,
          subject: userId,
          feature,
          requestId,
          provider: c.provider,
          model: c.model,
          tokensIn: c.tokensIn,
          tokensOut: c.tokensOut,
          costUsd: c.costUsd,
          latencyMs: c.latencyMs,
          status: c.ok ? ("ok" as const) : ("error" as const),
          error: c.error ?? null,
        })),
      ]);
    } catch (error) {
      log.warn("usage", "bookkeeping failed after a billed request", { feature, error: error instanceof Error ? error.message : String(error) });
    }

    if (thrown !== null) throw thrown;
    if (response && credits > 0) response.headers.set("X-Credits-Remaining", String(Math.max(0, remaining)));
    return response as Response;
  };
}
