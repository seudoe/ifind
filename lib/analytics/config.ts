/** Analytics configuration helpers: date ranges, env checks and service-account parsing. */

export const RANGES = ["today", "7d", "30d", "90d"] as const;
export type RangeKey = (typeof RANGES)[number];

export function parseRange(v: string | null): RangeKey | null {
  return (RANGES as readonly string[]).includes(v ?? "") ? (v as RangeKey) : null;
}

const GA_START: Record<RangeKey, string> = {
  today: "today",
  "7d": "6daysAgo",
  "30d": "29daysAgo",
  "90d": "89daysAgo",
};

/** GA4 Data API date range; "7d" covers today plus the six days before it. */
export function rangeToGaDates(r: RangeKey): { startDate: string; endDate: string } {
  return { startDate: GA_START[r], endDate: "today" };
}

/** Tracking only runs in production with a non-blank measurement id. */
export function trackingEnabled(env: { NODE_ENV?: string; NEXT_PUBLIC_GA_ID?: string }): boolean {
  return env.NODE_ENV === "production" && !!env.NEXT_PUBLIC_GA_ID?.trim();
}

const REQUIRED_ENV = {
  dashboard: ["GA_PROPERTY_ID", "GA_SERVICE_ACCOUNT_B64"],
  events: ["NEXT_PUBLIC_GA_ID", "GA_API_SECRET"],
} as const;

/** Names of the env vars a scope needs that are unset or blank. */
export function missingEnv(env: Record<string, string | undefined>, scope: "dashboard" | "events"): string[] {
  return REQUIRED_ENV[scope].filter((name) => !env[name]?.trim());
}

/** Decodes the base64 service-account JSON. Returns null on any problem; never throws. */
export function parseServiceAccount(b64: string): { client_email: string; private_key: string } | null {
  try {
    // atob + TextDecoder (not Buffer) so this module stays safe to import from client code.
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object") return null;
    const { client_email, private_key } = parsed as Record<string, unknown>;
    if (typeof client_email !== "string" || !client_email) return null;
    if (typeof private_key !== "string" || !private_key) return null;
    return { client_email, private_key };
  } catch {
    return null;
  }
}
