/**
 * Server-side GA4 events via the Measurement Protocol. SERVER ONLY: reads GA_API_SECRET, never import from
 * client code. Events are sent only for visitors who accepted the consent banner (they carry a `_ga` cookie),
 * and no identifying value (user id, email, username) is ever included.
 */
import { missingEnv, trackingEnabled } from "./config";
import type { AnalyticsEvent, EventParams } from "./events";

const COLLECT_URL = "https://www.google-analytics.com/mp/collect";
const TIMEOUT_MS = 2000;

function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** GA client id from the `_ga` cookie (`GA1.1.<id>.<timestamp>` gives "<id>.<timestamp>"). */
export function clientIdFromCookie(cookieHeader: string | null | undefined): string | null {
  const value = cookieValue(cookieHeader, "_ga");
  const match = value ? /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(value) : null;
  return match ? match[1] : null;
}

/** GA session id from the `_ga_<ID>` cookie for the given measurement id (GS1 and GS2 formats). */
export function sessionIdFromCookie(cookieHeader: string | null | undefined, measurementId: string): string | null {
  const value = cookieValue(cookieHeader, `_ga_${measurementId.replace(/^G-/, "")}`);
  if (!value) return null;
  const gs1 = /^GS1\.\d+\.(\d+)\./.exec(value);
  if (gs1) return gs1[1];
  const gs2 = /^GS2\.\d+\.s(\d+)(?:\$|$)/.exec(value);
  return gs2 ? gs2[1] : null;
}

interface Deps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
}

/**
 * Sends one event. Returns true when Google accepted it; false when it was skipped (not production, no consent
 * cookie, missing env) or failed. Never throws or rejects. Callers defer it with `after()` so the response is
 * not held up and the serverless function stays alive until it settles.
 */
export async function sendServerEvent(
  req: Request,
  name: AnalyticsEvent,
  params: EventParams = {},
  deps: Deps = {},
): Promise<boolean> {
  try {
    const env = deps.env ?? process.env;
    if (!trackingEnabled({ NODE_ENV: env.NODE_ENV, NEXT_PUBLIC_GA_ID: env.NEXT_PUBLIC_GA_ID })) return false;
    if (missingEnv(env, "events").length > 0) return false;
    const cookies = req.headers.get("cookie");
    const clientId = clientIdFromCookie(cookies);
    if (!clientId) return false;

    const measurementId = env.NEXT_PUBLIC_GA_ID!.trim();
    const apiSecret = env.GA_API_SECRET!.trim();
    const eventParams: Record<string, string | number> = { engagement_time_msec: 1 };
    if (params.user_type !== undefined) eventParams.user_type = params.user_type;
    if (params.internship_id !== undefined) eventParams.internship_id = params.internship_id;
    if (params.result_count !== undefined) eventParams.result_count = params.result_count;
    const sessionId = sessionIdFromCookie(cookies, measurementId);
    if (sessionId) eventParams.session_id = Number(sessionId);

    const url = `${COLLECT_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const res = await (deps.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, events: [{ name, params: eventParams }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
