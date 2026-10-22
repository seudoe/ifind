import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import RateLimit from "@/models/RateLimit";
import { log } from "@/lib/logger";

interface Rule {
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

/**
 * Fixed-window limiter stored in MongoDB, so the count is shared by every serverless instance
 * (an in-memory Map would reset per cold start and per instance). One atomic upsert per call.
 * Fails open if the database is unreachable: the route needs the database anyway.
 */
export async function hit(scope: string, subject: string, rule: Rule): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = `${scope}:${createHash("sha256").update(subject).digest("hex").slice(0, 24)}:${windowStart}`;
  const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));

  try {
    await connectDB();
    const row = await RateLimit.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
      { upsert: true, new: true },
    ).lean();
    return { ok: (row?.count ?? 1) <= rule.limit, retryAfter };
  } catch (error) {
    // Two first requests can race on the upsert; the loser gets a duplicate-key error, which still means "counted".
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return { ok: true, retryAfter };
    log.warn("rate-limit", "limiter unavailable, allowing request", { scope, error: error instanceof Error ? error.message : String(error) });
    return { ok: true, retryAfter };
  }
}

/** Client address as set by the platform (Vercel overwrites these, so they can't be spoofed by the client there). */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { success: false, error: "Too many attempts. Please wait a bit and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** Named policies so limits are tuned in one place. */
export const RULES = {
  loginIp: { limit: 30, windowSec: 15 * 60 },
  loginAccount: { limit: 8, windowSec: 15 * 60 },
  registerIp: { limit: 10, windowSec: 60 * 60 },
  sensitiveUser: { limit: 10, windowSec: 60 * 60 },
  uploadUser: { limit: 30, windowSec: 60 * 60 },
  // Billed AI routes. Daily credits bound a day; these bound a minute and a network address. The address cap is
  // generous on purpose: a campus Wi-Fi puts hundreds of real students behind one IP.
  aiUserBurst: { limit: 12, windowSec: 60 },
  aiIp: { limit: 600, windowSec: 60 * 60 },
  // Writes that fan out to the vectoriser or the moderation pipeline, and free-to-create records.
  profileWrite: { limit: 60, windowSec: 60 * 60 },
  chatSessionCreate: { limit: 30, windowSec: 60 * 60 },
  employerWrite: { limit: 120, windowSec: 60 * 60 },
  employerModeration: { limit: 20, windowSec: 60 * 60 },
  // Unauthenticated endpoints that make the server call another service.
  oauthIp: { limit: 40, windowSec: 15 * 60 },
} as const satisfies Record<string, Rule>;

/**
 * Applies a per-IP rule and, when given, a per-account rule. Returns the 429 to send, or null to continue.
 * Per-account limits stop a distributed brute force against one login; per-IP limits stop one host
 * from sweeping many accounts.
 */
export async function limitAuth(
  request: Request,
  scope: string,
  ipRule: Rule,
  account?: { id: string; rule: Rule },
): Promise<NextResponse | null> {
  const ip = await hit(`${scope}:ip`, clientIp(request), ipRule);
  if (!ip.ok) return tooManyRequests(ip.retryAfter);
  if (account) {
    const acct = await hit(`${scope}:acct`, account.id, account.rule);
    if (!acct.ok) return tooManyRequests(acct.retryAfter);
  }
  return null;
}
