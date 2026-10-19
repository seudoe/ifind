/**
 * GA4 Data API reports for the moderator Analytics tab.
 *
 * SERVER-ONLY: this module talks to the Data API with service-account credentials. Client code may
 * only `import type` from it. Reports are aggregate counts; no personal data is requested.
 */
import type { BetaAnalyticsDataClient } from "@google-analytics/data";
import { rangeToGaDates } from "./config";
import type { RangeKey } from "./config";

export type GaClient = Pick<BetaAnalyticsDataClient, "runReport" | "runRealtimeReport">;

export type FunnelStepKey = "visit" | "sign_up" | "view_internship" | "applied";

export interface FunnelReport {
  steps: { key: FunnelStepKey; label: string; users: number }[];
  applyClickUsers: number;
  applicationSubmittedUsers: number;
}

export interface OverviewReport {
  kpis: { activeUsers: number; sessions: number; newUsers: number; pageviews: number };
  daily: { date: string; users: number; sessions: number }[];
  sources: { channel: string; users: number }[];
  topPages: { path: string; views: number }[];
  devices: { device: string; users: number }[];
  countries: { country: string; users: number }[];
  /** `null` when the `internship_id` custom dimension is not registered in GA yet. */
  topInternships: { internshipId: string; views: number }[] | null;
  funnel: FunnelReport;
}

const TOP_N = 10;
const FUNNEL_EVENTS = ["sign_up", "view_internship", "apply_click", "application_submitted"];
const APPLIED_EVENTS = ["apply_click", "application_submitted"];

export function computeFunnel(i: {
  visitUsers: number;
  eventUsers: Record<string, number>;
  appliedUnionUsers: number;
}): FunnelReport {
  const users = (event: string) => i.eventUsers[event] ?? 0;
  return {
    steps: [
      { key: "visit", label: "Visited", users: i.visitUsers },
      { key: "sign_up", label: "Signed up", users: users("sign_up") },
      { key: "view_internship", label: "Viewed an internship", users: users("view_internship") },
      // The union of apply_click and application_submitted, so nobody is counted twice.
      { key: "applied", label: "Applied", users: i.appliedUnionUsers },
    ],
    applyClickUsers: users("apply_click"),
    applicationSubmittedUsers: users("application_submitted"),
  };
}

type ReportRows = { dimensionValues?: { value?: string | null }[] | null; metricValues?: { value?: string | null }[] | null }[];

/** Rows of a `[response]` tuple; a response with no `rows` yields []. */
function rowsOf(res: readonly [{ rows?: ReportRows | null } | undefined, ...unknown[]]): ReportRows {
  return res[0]?.rows ?? [];
}

const num = (v: string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const dim = (row: ReportRows[number], i = 0): string => row.dimensionValues?.[i]?.value ?? "";
const metric = (row: ReportRows[number], i = 0): number => num(row.metricValues?.[i]?.value);

/** `20261019` to `2026-10-19`; anything else is returned unchanged. */
function formatGaDate(v: string): string {
  return /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v;
}

const topBy = (metricName: string) => ({ orderBys: [{ metric: { metricName }, desc: true }], limit: TOP_N });

export async function fetchOverviewReport(
  client: GaClient,
  propertyId: string,
  range: RangeKey,
): Promise<OverviewReport> {
  const base = { property: `properties/${propertyId}`, dateRanges: [rangeToGaDates(range)] };
  const names = (...n: string[]) => n.map((name) => ({ name }));

  const [kpiRes, dailyRes, sourcesRes, pagesRes, devicesRes, countriesRes, eventsRes, appliedRes, visitRes, internshipsRes] =
    await Promise.all([
      client.runReport({
        ...base,
        metrics: names("activeUsers", "sessions", "newUsers", "screenPageViews"),
      }),
      client.runReport({
        ...base,
        dimensions: names("date"),
        metrics: names("activeUsers", "sessions"),
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      client.runReport({
        ...base,
        dimensions: names("sessionDefaultChannelGroup"),
        metrics: names("activeUsers"),
        ...topBy("activeUsers"),
      }),
      client.runReport({
        ...base,
        dimensions: names("pagePath"),
        metrics: names("screenPageViews"),
        ...topBy("screenPageViews"),
      }),
      client.runReport({
        ...base,
        dimensions: names("deviceCategory"),
        metrics: names("activeUsers"),
        ...topBy("activeUsers"),
      }),
      client.runReport({
        ...base,
        dimensions: names("country"),
        metrics: names("activeUsers"),
        ...topBy("activeUsers"),
      }),
      client.runReport({
        ...base,
        dimensions: names("eventName"),
        metrics: names("totalUsers"),
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: FUNNEL_EVENTS } } },
      }),
      client.runReport({
        ...base,
        metrics: names("totalUsers"),
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: APPLIED_EVENTS } } },
      }),
      client.runReport({ ...base, metrics: names("totalUsers") }),
      // Isolated: fails until `internship_id` is registered as a custom dimension in GA.
      client
        .runReport({
          ...base,
          dimensions: names("customEvent:internship_id"),
          metrics: names("eventCount"),
          dimensionFilter: {
            filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "view_internship" } },
          },
          ...topBy("eventCount"),
        })
        .catch(() => null),
    ]);

  const kpiRow = rowsOf(kpiRes)[0];
  const eventUsers: Record<string, number> = {};
  for (const row of rowsOf(eventsRes)) eventUsers[dim(row)] = metric(row);

  return {
    kpis: {
      activeUsers: kpiRow ? metric(kpiRow, 0) : 0,
      sessions: kpiRow ? metric(kpiRow, 1) : 0,
      newUsers: kpiRow ? metric(kpiRow, 2) : 0,
      pageviews: kpiRow ? metric(kpiRow, 3) : 0,
    },
    daily: rowsOf(dailyRes).map((r) => ({ date: formatGaDate(dim(r)), users: metric(r, 0), sessions: metric(r, 1) })),
    sources: rowsOf(sourcesRes).map((r) => ({ channel: dim(r), users: metric(r) })),
    topPages: rowsOf(pagesRes).map((r) => ({ path: dim(r), views: metric(r) })),
    devices: rowsOf(devicesRes).map((r) => ({ device: dim(r), users: metric(r) })),
    countries: rowsOf(countriesRes).map((r) => ({ country: dim(r), users: metric(r) })),
    topInternships: internshipsRes ? rowsOf(internshipsRes).map((r) => ({ internshipId: dim(r), views: metric(r) })) : null,
    funnel: computeFunnel({
      visitUsers: metric(rowsOf(visitRes)[0] ?? {}),
      eventUsers,
      appliedUnionUsers: metric(rowsOf(appliedRes)[0] ?? {}),
    }),
  };
}

/** Users active in the last ~30 minutes. */
export async function fetchRealtime(client: GaClient, propertyId: string): Promise<{ activeUsers: number }> {
  const res = await client.runRealtimeReport({
    property: `properties/${propertyId}`,
    metrics: [{ name: "activeUsers" }],
  });
  const row = rowsOf(res)[0];
  return { activeUsers: row ? metric(row) : 0 };
}
