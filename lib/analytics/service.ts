/**
 * The cached analytics service behind the moderator Analytics tab.
 *
 * SERVER-ONLY: builds a service-account GA client. Client code may only `import type` from here.
 * Results and errors never contain secret values; `missing` lists env var NAMES only.
 */
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { cachedReport } from "./cache";
import type { CacheStore } from "./cache";
import { missingEnv, parseServiceAccount } from "./config";
import type { RangeKey } from "./config";
import { fetchOverviewReport, fetchRealtime } from "./reports";
import type { GaClient, OverviewReport } from "./reports";

export type AnalyticsResult =
  | { configured: false; missing: string[] }
  | {
      configured: true;
      view: "overview" | "realtime";
      range: RangeKey;
      report: OverviewReport | { activeUsers: number };
      stale: boolean;
      fetchedAt: string;
    };

type ServiceAccount = { client_email: string; private_key: string };

const OVERVIEW_TTL_SECONDS = 300;
const REALTIME_TTL_SECONDS = 60;

function defaultCreateClient(sa: ServiceAccount): GaClient {
  return new BetaAnalyticsDataClient({ credentials: { client_email: sa.client_email, private_key: sa.private_key } });
}

export async function getAnalytics(o: {
  view: "overview" | "realtime";
  range: RangeKey;
  env: Record<string, string | undefined>;
  store: CacheStore | null;
  createClient?: (sa: ServiceAccount) => GaClient;
}): Promise<AnalyticsResult> {
  const { view, range, env, store } = o;

  const missing = missingEnv(env, "dashboard");
  const sa = missing.includes("GA_SERVICE_ACCOUNT_B64") ? null : parseServiceAccount(env.GA_SERVICE_ACCOUNT_B64 ?? "");
  // Present but malformed counts as missing (name only; the value is never echoed).
  if (!missing.includes("GA_SERVICE_ACCOUNT_B64") && !sa) missing.push("GA_SERVICE_ACCOUNT_B64");
  if (missing.length > 0 || !sa) return { configured: false, missing };

  const propertyId = (env.GA_PROPERTY_ID ?? "").trim();
  // Built lazily so a cache hit never constructs a client.
  const client = () => (o.createClient ?? defaultCreateClient)(sa);

  const cached =
    view === "overview"
      ? await cachedReport<OverviewReport | { activeUsers: number }>({
          key: `ga:${propertyId}:overview:${range}`,
          ttlSeconds: OVERVIEW_TTL_SECONDS,
          store,
          fetcher: () => fetchOverviewReport(client(), propertyId, range),
        })
      : await cachedReport<OverviewReport | { activeUsers: number }>({
          key: `ga:${propertyId}:realtime:now`,
          ttlSeconds: REALTIME_TTL_SECONDS,
          store,
          fetcher: () => fetchRealtime(client(), propertyId),
        });

  return { configured: true, view, range, report: cached.data, stale: cached.stale, fetchedAt: cached.fetchedAt };
}
