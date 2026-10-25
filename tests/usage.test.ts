/**
 * Usage limits: IST day boundaries, cost estimates, flag rules, and the atomic credit pool.
 * Run with: npm run test:usage  (the quota tests start an in-memory MongoDB)
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { buildFlags, maxInRollingWindow, topCostStreak, type UserMetrics } from "../lib/usage/flags";
import { FLAG_THRESHOLDS } from "../lib/usage/config";
import { estimateCostUsd } from "../lib/usage/pricing";
import { istDay, nextIstMidnight } from "../lib/usage/time";

describe("IST day", () => {
  it("rolls over at 18:30 UTC", () => {
    assert.equal(istDay(new Date("2026-10-19T18:29:59Z")), "2026-10-19");
    assert.equal(istDay(new Date("2026-10-19T18:30:00Z")), "2026-10-20");
  });

  it("next midnight is the following 18:30 UTC", () => {
    assert.equal(nextIstMidnight(new Date("2026-10-19T10:00:00Z")).toISOString(), "2026-10-19T18:30:00.000Z");
    assert.equal(nextIstMidnight(new Date("2026-10-19T18:30:00Z")).toISOString(), "2026-10-20T18:30:00.000Z");
  });
});

describe("cost estimate", () => {
  it("uses the price table", () => {
    assert.equal(estimateCostUsd("cohere", "command-a-03-2025", 1_000_000, 1_000_000), 12.5);
    assert.equal(estimateCostUsd("groq", "llama-3.3-70b-versatile", 1000, 0), 0.00059);
  });

  it("never treats an unknown model as free", () => {
    assert.ok(estimateCostUsd("groq", "some-new-model", 1000, 1000) > 0);
  });
});

describe("flag rules", () => {
  const quiet: UserMetrics = { limitHitDays7: 0, maxRequestsPerMinute: 2, maxRepeatedRequests: 1, failedLogins24h: 0, maxApplicationsPerHour: 3, topCostStreak: 0 };

  it("flags nothing for a normal user", () => {
    assert.deepEqual(buildFlags(quiet, FLAG_THRESHOLDS), []);
  });

  it("flags each rule at its threshold", () => {
    const flags = buildFlags(
      { limitHitDays7: 3, maxRequestsPerMinute: 11, maxRepeatedRequests: 5, failedLogins24h: 10, maxApplicationsPerHour: 31, topCostStreak: 3 },
      FLAG_THRESHOLDS,
    );
    assert.deepEqual(flags.map((f) => f.code).sort(), ["application_burst", "burst", "failed_logins", "limit_repeated", "repeated_requests", "top_cost"]);
  });

  it("does not flag just under the threshold", () => {
    const flags = buildFlags(
      { limitHitDays7: 2, maxRequestsPerMinute: 10, maxRepeatedRequests: 4, failedLogins24h: 9, maxApplicationsPerHour: 30, topCostStreak: 2 },
      FLAG_THRESHOLDS,
    );
    assert.deepEqual(flags, []);
  });
});

describe("rolling window", () => {
  it("finds the busiest hour", () => {
    const h = 3_600_000;
    assert.equal(maxInRollingWindow([0, 1, 2, 10 * h, 10 * h + 5, 10 * h + 9, 10 * h + 12], h), 4);
    assert.equal(maxInRollingWindow([], h), 0);
  });
});

describe("top-cost streak", () => {
  const day = (n: number, top: string) => ({
    costs: Array.from({ length: n }, (_, i) => ({ subject: i === 0 ? top : `u${i}`, costUsd: n - i })),
  });

  it("counts consecutive days in the top share", () => {
    assert.equal(topCostStreak([day(30, "a"), day(30, "a"), day(30, "a")], "a", 1), 3);
  });

  it("stops at the first day the user is not on top", () => {
    assert.equal(topCostStreak([day(30, "a"), day(30, "b"), day(30, "a")], "a", 1), 1);
  });

  it("does not rank when too few users were active", () => {
    assert.equal(topCostStreak([day(5, "a")], "a", 1), 0);
  });
});

describe("credit pool (in-memory MongoDB)", () => {
  let stop: (() => Promise<void>) | undefined;
  let quota: typeof import("../lib/usage/quota");
  let skip: string | false = false;

  before(async () => {
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const server = await MongoMemoryServer.create();
      process.env.MONGODB_URI = server.getUri("usage_test");
      quota = await import("../lib/usage/quota");
      const { default: UsageDaily } = await import("../models/UsageDaily");
      await (await import("../lib/db")).connectDB();
      await UsageDaily.init();
      stop = async () => {
        const mongoose = (await import("mongoose")).default;
        await mongoose.disconnect();
        await server.stop();
      };
    } catch (error) {
      skip = `in-memory MongoDB unavailable: ${error instanceof Error ? error.message : error}`;
    }
  });

  after(async () => {
    await stop?.();
  });

  it("hands out credits until the limit, then refuses", { skip: false }, async (t) => {
    if (skip) return t.skip(skip);
    assert.deepEqual(await quota.reserveCredits("u1", 5, 12, "job-match"), { ok: true, remaining: 7, limit: 12 });
    assert.deepEqual(await quota.reserveCredits("u1", 5, 12, "job-match"), { ok: true, remaining: 2, limit: 12 });
    const refused = await quota.reserveCredits("u1", 5, 12, "job-match");
    assert.equal(refused.ok, false);
    assert.equal(refused.remaining, 2);
    assert.equal((await quota.reserveCredits("u1", 2, 12, "chat")).ok, true);
  });

  it("a refund makes the credits usable again", async (t) => {
    if (skip) return t.skip(skip);
    await quota.reserveCredits("u2", 5, 5, "job-match");
    assert.equal((await quota.reserveCredits("u2", 1, 5, "chat")).ok, false);
    await quota.refundCredits("u2", 5);
    assert.equal((await quota.reserveCredits("u2", 1, 5, "chat")).ok, true);
  });

  it("refuses a request bigger than the whole limit, even on a fresh day", async (t) => {
    if (skip) return t.skip(skip);
    const result = await quota.reserveCredits("u3", 5, 3, "job-match");
    assert.equal(result.ok, false);
    assert.equal((await quota.getDaily("user", "u3"))?.creditsUsed, 0);
  });

  it("never lets simultaneous requests exceed the limit", async (t) => {
    if (skip) return t.skip(skip);
    const results = await Promise.all(Array.from({ length: 20 }, () => quota.reserveCredits("u4", 1, 7, "chat")));
    assert.equal(results.filter((r) => r.ok).length, 7);
    assert.equal((await quota.getDaily("user", "u4"))?.creditsUsed, 7);
  });

  it("marks the day as limit-hit and counts blocked requests", async (t) => {
    if (skip) return t.skip(skip);
    await quota.reserveCredits("u5", 2, 2, "chat");
    await quota.reserveCredits("u5", 1, 2, "chat");
    await quota.reserveCredits("u5", 1, 2, "chat");
    const day = await quota.getDaily("user", "u5");
    assert.equal(day?.hitLimit, true);
    assert.equal(day?.blocked, 2);
  });

  describe("withBilling", () => {
    const session = { userId: "aaaaaaaaaaaaaaaaaaaaaaa1", email: "a@b.c", username: "bill", role: "student" as const };
    const request = (body: unknown = { q: 1 }) =>
      new NextRequest("http://localhost/api/test", { method: "POST", body: JSON.stringify(body) });

    async function setup() {
      const { withBilling } = await import("../lib/usage/withBilling");
      const { recordLlmCall } = await import("../lib/usage/context");
      const { default: UsageLog } = await import("../models/UsageLog");
      return { withBilling, recordLlmCall, UsageLog };
    }

    it("charges credits, logs the request and each provider call, and reports what is left", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling, recordLlmCall, UsageLog } = await setup();
      const route = withBilling(
        "job-match",
        async () => {
          recordLlmCall({ provider: "groq", model: "llama-3.3-70b-versatile", tokensIn: 1000, tokensOut: 500, latencyMs: 120, ok: true });
          recordLlmCall({ provider: "groq", model: "llama-3.3-70b-versatile", tokensIn: 2000, tokensOut: 100, latencyMs: 80, ok: true });
          return Response.json({ success: true });
        },
        { getSession: async () => session },
      );
      const res = await route(request(), undefined);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("X-Credits-Remaining"), "35");

      const day = await quota.getDaily("user", "aaaaaaaaaaaaaaaaaaaaaaa1");
      assert.equal(day?.creditsUsed, 5);
      assert.equal(day?.llmCalls, 2);
      assert.equal(day?.tokensIn, 3000);
      assert.ok((day?.costUsd ?? 0) > 0);
      assert.equal(await UsageLog.countDocuments({ subject: "aaaaaaaaaaaaaaaaaaaaaaa1", kind: "call" }), 2);
      const [req] = await UsageLog.find({ subject: "aaaaaaaaaaaaaaaaaaaaaaa1", kind: "request" }).lean();
      assert.equal(req.status, "ok");
      assert.equal(req.credits, 5);
      assert.ok(req.reqHash);
    });

    it("answers 429 with the reset time once the pool is empty, without running the handler", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling } = await setup();
      let ran = 0;
      const route = withBilling("job-match", async () => { ran++; return Response.json({ success: true }); }, { getSession: async () => ({ ...session, userId: "aaaaaaaaaaaaaaaaaaaaaaa2" }) });
      await quota.reserveCredits("aaaaaaaaaaaaaaaaaaaaaaa2", 40, 40, "chat");
      const res = await route(request(), undefined);
      assert.equal(res.status, 429);
      const body = await res.json();
      assert.equal(body.code, "DAILY_LIMIT");
      assert.equal(body.remaining, 0);
      assert.ok(body.resetsAt);
      assert.ok(Number(res.headers.get("Retry-After")) > 0);
      assert.equal(ran, 0);
    });

    it("refunds when the provider fails (5xx) or the request never reached a provider", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling, recordLlmCall } = await setup();
      const failing = withBilling("chat", async () => {
        recordLlmCall({ provider: "groq", model: "llama-3.3-70b-versatile", latencyMs: 10, ok: false, error: "boom" });
        return Response.json({ error: "x" }, { status: 500 });
      }, { getSession: async () => ({ ...session, userId: "aaaaaaaaaaaaaaaaaaaaaaa3" }) });
      const badInput = withBilling("chat", async () => Response.json({ error: "missing field" }, { status: 400 }), { getSession: async () => ({ ...session, userId: "aaaaaaaaaaaaaaaaaaaaaaa3" }) });
      const throws = withBilling("chat", async () => { throw new Error("kaput"); }, { getSession: async () => ({ ...session, userId: "aaaaaaaaaaaaaaaaaaaaaaa3" }) });

      assert.equal((await failing(request(), undefined)).status, 500);
      assert.equal((await badInput(request(), undefined)).status, 400);
      await assert.rejects(throws(request(), undefined), /kaput/);
      assert.equal((await quota.getDaily("user", "aaaaaaaaaaaaaaaaaaaaaaa3"))?.creditsUsed, 0);
    });

    it("uses a moderator's per-user override instead of the default", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling } = await setup();
      const { default: User } = await import("../models/User");
      const user = await User.create({ name: "Cap", username: "capped", email: "cap@example.com", dailyCreditLimit: 1 });
      const route = withBilling("star", async () => Response.json({ ok: 1 }), { getSession: async () => ({ ...session, userId: String(user._id) }) });
      // star costs 2 credits, the override allows 1: refused immediately
      assert.equal((await route(request(), undefined)).status, 429);
    });

    it("rejects signed-out requests", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling } = await setup();
      const route = withBilling("chat", async () => Response.json({}), { getSession: async () => null });
      assert.equal((await route(request(), undefined)).status, 401);
    });
  });

  describe("abuse limits", () => {
    const session = (id: string) => ({ userId: id, email: "a@b.c", username: "abuse", role: "student" as const });
    const request = () => new NextRequest("http://localhost/api/test", { method: "POST", body: JSON.stringify({ q: 1 }) });
    async function setup() {
      const { withBilling } = await import("../lib/usage/withBilling");
      const { recordLlmCall } = await import("../lib/usage/context");
      const { default: UsageSettings } = await import("../models/UsageSettings");
      const { clearUsageSettingsCache } = await import("../lib/usage/settings");
      return { withBilling, recordLlmCall, UsageSettings, clearUsageSettingsCache };
    }

    it("stops billed routes with 503 once the site-wide daily budget is spent, and 0 turns the cap off", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling, recordLlmCall, UsageSettings, clearUsageSettingsCache } = await setup();
      let ran = 0;
      const user = "bbbbbbbbbbbbbbbbbbbbbbb1";
      const route = withBilling("chat", async () => {
        ran++;
        recordLlmCall({ provider: "groq", model: "llama-3.3-70b-versatile", tokensIn: 100_000, tokensOut: 10_000, latencyMs: 5, ok: true });
        return Response.json({ ok: 1 });
      }, { getSession: async () => session(user) });
      try {
        assert.equal((await route(request(), undefined)).status, 200); // spends real (estimated) money, recorded site-wide
        const spent = (await quota.getDaily("system", quota.SYSTEM_SUBJECT))?.costUsd ?? 0;
        assert.ok(spent > 0, "the call was not added to the site-wide total");

        await UsageSettings.updateOne({ _id: "global" }, { $set: { systemDailyBudgetUsd: spent / 2 } }, { upsert: true });
        clearUsageSettingsCache();
        const before = ran;
        const blocked = await route(request(), undefined);
        assert.equal(blocked.status, 503);
        assert.equal((await blocked.json()).code, "SYSTEM_BUDGET");
        assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
        assert.equal(ran, before, "the handler ran although the budget was spent");
        assert.equal((await quota.getDaily("user", user))?.creditsUsed, 1, "a blocked request must not take credits");

        await UsageSettings.updateOne({ _id: "global" }, { $set: { systemDailyBudgetUsd: 0 } });
        clearUsageSettingsCache();
        assert.equal((await route(request(), undefined)).status, 200);
      } finally {
        await UsageSettings.deleteOne({ _id: "global" });
        clearUsageSettingsCache();
      }
    });

    it("answers 429 when one user sends more than 12 billed requests in a minute", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling } = await setup();
      const route = withBilling("chat", async () => Response.json({ ok: 1 }), { getSession: async () => session("bbbbbbbbbbbbbbbbbbbbbbb2") });
      const statuses: number[] = [];
      for (let i = 0; i < 14; i++) statuses.push((await route(request(), undefined)).status);
      assert.deepEqual(statuses.slice(0, 12), Array(12).fill(200));
      assert.deepEqual(statuses.slice(12), [429, 429]);
    });

    it("does not refund a request that failed after a provider call had already succeeded", async (t) => {
      if (skip) return t.skip(skip);
      const { withBilling, recordLlmCall } = await setup();
      const user = "bbbbbbbbbbbbbbbbbbbbbbb3";
      const lateFailure = withBilling("chat", async () => {
        recordLlmCall({ provider: "groq", model: "llama-3.3-70b-versatile", tokensIn: 10, tokensOut: 10, latencyMs: 5, ok: true });
        return Response.json({ error: "could not save" }, { status: 500 });
      }, { getSession: async () => session(user) });
      assert.equal((await lateFailure(request(), undefined)).status, 500);
      assert.equal((await quota.getDaily("user", user))?.creditsUsed, 1);
    });

    it("the paid extractor is not used once the site budget is spent", async (t) => {
      if (skip) return t.skip(skip);
      const { UsageSettings, clearUsageSettingsCache } = await setup();
      const { paidAiAllowed } = await import("../lib/aiExtractionQuota");
      try {
        await UsageSettings.updateOne({ _id: "global" }, { $set: { systemDailyBudgetUsd: 1e-9 } }, { upsert: true });
        clearUsageSettingsCache();
        assert.equal(await paidAiAllowed(), false);
        await UsageSettings.updateOne({ _id: "global" }, { $set: { systemDailyBudgetUsd: 0 } });
        clearUsageSettingsCache();
        assert.equal(await paidAiAllowed(), true);
      } finally {
        await UsageSettings.deleteOne({ _id: "global" });
        clearUsageSettingsCache();
      }
    });
  });

  describe("ban signals", () => {
    it("computes usage, behaviour and flags for a user from the stored records", async (t) => {
      if (skip) return t.skip(skip);
      const { default: User } = await import("../models/User");
      const { default: UsageLog } = await import("../models/UsageLog");
      const { default: UsageDaily } = await import("../models/UsageDaily");
      const { getUserSignals, getFlagsForUsers } = await import("../lib/usage/signals");
      const { istDay } = await import("../lib/usage/time");

      const now = Date.now();
      const user = await User.create({
        name: "Busy", username: "busybee", email: "busy@example.com", linkedinId: "li-busy",
        lastLoginAt: new Date(now - 3_600_000), loginCount: 7,
        failedLoginAttempts: Array.from({ length: 10 }, (_, i) => new Date(now - i * 60_000)),
        appliedInternships: Array.from({ length: 31 }, (_, i) => ({ appliedAt: new Date(now - i * 60_000) })),
      });
      const id = String(user._id);

      // 12 identical requests inside one minute, one of them blocked
      await UsageLog.insertMany(
        Array.from({ length: 12 }, (_, i) => ({
          ts: new Date(now - 30_000 + i * 100), kind: "request", scope: "user", subject: id, feature: "chat",
          status: i === 11 ? "blocked" : "ok", credits: 1, costUsd: 0.001, reqHash: "same-body",
        })),
      );
      // limit hit on 3 of the last 7 days
      await UsageDaily.insertMany(
        [0, 1, 2].map((d) => ({
          scope: "user", subject: id, day: istDay(new Date(now - d * 86_400_000)),
          creditsUsed: 40, requests: 40, blocked: 2, hitLimit: true, llmCalls: 40, tokensIn: 4000, tokensOut: 2000, costUsd: 0.5,
          byFeature: { chat: 30, "job-match": 10 },
        })),
      );

      const signals = await getUserSignals(id);
      assert.ok(signals);
      assert.equal(signals.account.loginCount, 7);
      assert.equal(signals.account.failedLogins24h, 10);
      assert.equal(signals.account.maxApplicationsPerHour, 31);
      assert.equal(signals.behaviour.maxRequestsPerMinute, 12);
      assert.equal(signals.behaviour.maxRepeatedRequests, 11); // the blocked one isn't counted as a repeat
      assert.equal(signals.behaviour.limitHitDays7, 3);
      assert.equal(signals.usage.last30.costUsd, 1.5);
      assert.equal(signals.byFeature30.chat, 90);
      assert.equal(signals.credits.limit, 40);
      assert.deepEqual(
        signals.flags.map((f) => f.code).sort(),
        ["application_burst", "burst", "failed_logins", "limit_repeated", "repeated_requests"],
      );

      const bulk = await getFlagsForUsers([id]);
      assert.equal(bulk[id].length, 5);
    });
  });
});
