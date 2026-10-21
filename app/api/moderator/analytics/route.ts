import { NextRequest, NextResponse } from "next/server";
import { getModSession } from "@/lib/moderatorAuth";
import { getAnalytics } from "@/lib/analytics/service";
import { redisStore } from "@/lib/analytics/redis";
import { parseRange } from "@/lib/analytics/config";

export const runtime = "nodejs";

const VIEWS = ["overview", "realtime"] as const;
type View = (typeof VIEWS)[number];

/** Moderator reports must not be held by a browser cache beyond the server-side cache. */
const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** GET /api/moderator/analytics?view=overview|realtime&range=today|7d|30d|90d (defaults: overview, 7d). */
export async function GET(request: NextRequest) {
  const session = await getModSession();
  if (!session || !session.isVerified) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  const params = request.nextUrl.searchParams;

  const rawView = params.get("view");
  const view = rawView === null ? "overview" : (VIEWS as readonly string[]).includes(rawView) ? (rawView as View) : null;
  if (!view) return json({ success: false, error: "view must be overview or realtime" }, 400);

  const rawRange = params.get("range");
  const range = rawRange === null ? "7d" : parseRange(rawRange);
  if (!range) return json({ success: false, error: "range must be today, 7d, 30d or 90d" }, 400);

  try {
    const data = await getAnalytics({ view, range, env: process.env, store: redisStore() });
    return json({ success: true, data });
  } catch (error) {
    // Message only, trimmed: Google client errors can carry request config, so never log or return the object.
    const message = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
    console.error("[moderator/analytics]", message);
    return json({ success: false, error: "Analytics unavailable" }, 502);
  }
}
