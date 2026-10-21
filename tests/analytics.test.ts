/**
 * Analytics: event names, range parsing, env helpers, service-account parsing.
 * Run with: npm run test:analytics
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missingEnv, parseRange, parseServiceAccount, rangeToGaDates, trackingEnabled } from "../lib/analytics/config";
import { locationParams, sanitizePagePath, sanitizeUrl, userTypeFromPath } from "../lib/analytics/events";
import type { AnalyticsEvent, EventParams } from "../lib/analytics/events";
import { CONSENT_KEY, clearGaCookies, gaCookieExpiries, readConsent, shouldLoadGa, shouldShowBanner, writeConsent } from "../lib/analytics/consent";
import { buildGtagEventParams, trackWith } from "../lib/analytics/track";
import { clientIdFromCookie, sendServerEvent, sessionIdFromCookie } from "../lib/analytics/measurementProtocol";
import { computeFunnel, fetchOverviewReport, fetchRealtime } from "../lib/analytics/reports";
import type { GaClient } from "../lib/analytics/reports";
import { cachedReport } from "../lib/analytics/cache";
import type { CacheStore } from "../lib/analytics/cache";
import { redisStore, withTimeout } from "../lib/analytics/redis";
import { getAnalytics } from "../lib/analytics/service";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

describe("parseRange", () => {
  it("accepts known ranges and rejects the rest", () => {
    assert.equal(parseRange("7d"), "7d");
    assert.equal(parseRange("1y"), null);
    assert.equal(parseRange(null), null);
  });
});

describe("rangeToGaDates", () => {
  it("maps ranges to GA relative dates", () => {
    assert.deepEqual(rangeToGaDates("today"), { startDate: "today", endDate: "today" });
    assert.deepEqual(rangeToGaDates("7d"), { startDate: "6daysAgo", endDate: "today" });
    assert.deepEqual(rangeToGaDates("30d"), { startDate: "29daysAgo", endDate: "today" });
    assert.deepEqual(rangeToGaDates("90d"), { startDate: "89daysAgo", endDate: "today" });
  });
});

describe("trackingEnabled", () => {
  it("is on only in production with a non-blank GA id", () => {
    assert.equal(trackingEnabled({ NODE_ENV: "production", NEXT_PUBLIC_GA_ID: "G-X" }), true);
    assert.equal(trackingEnabled({ NODE_ENV: "development", NEXT_PUBLIC_GA_ID: "G-X" }), false);
    assert.equal(trackingEnabled({ NODE_ENV: "production", NEXT_PUBLIC_GA_ID: "" }), false);
    assert.equal(trackingEnabled({ NODE_ENV: "production", NEXT_PUBLIC_GA_ID: "  " }), false);
  });
});

describe("missingEnv", () => {
  it("lists missing variables per scope", () => {
    assert.deepEqual(missingEnv({}, "dashboard"), ["GA_PROPERTY_ID", "GA_SERVICE_ACCOUNT_B64"]);
    assert.deepEqual(missingEnv({}, "events"), ["NEXT_PUBLIC_GA_ID", "GA_API_SECRET"]);
    assert.deepEqual(missingEnv({ GA_PROPERTY_ID: "1", GA_SERVICE_ACCOUNT_B64: "x" }, "dashboard"), []);
    assert.deepEqual(missingEnv({ NEXT_PUBLIC_GA_ID: "G-X", GA_API_SECRET: "s" }, "events"), []);
  });
});

describe("parseServiceAccount", () => {
  it("returns the credentials from valid base64 JSON", () => {
    const sa = parseServiceAccount(
      b64(JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "k" })),
    );
    assert.deepEqual(sa, { client_email: "a@b.iam.gserviceaccount.com", private_key: "k" });
  });

  it("decodes UTF-8 content", () => {
    const sa = parseServiceAccount(b64(JSON.stringify({ client_email: "é@b.com", private_key: "k✓" })));
    assert.deepEqual(sa, { client_email: "é@b.com", private_key: "k✓" });
  });

  it("returns null instead of throwing on bad input", () => {
    assert.equal(parseServiceAccount("%%%"), null);
    assert.equal(parseServiceAccount(b64("{}")), null);
    assert.equal(parseServiceAccount(b64("not json")), null);
  });
});

describe("userTypeFromPath", () => {
  it("derives the user type from the route", () => {
    assert.equal(userTypeFromPath("/employer/companies"), "employer");
    assert.equal(userTypeFromPath("/user/sam/browse"), "student");
    assert.equal(userTypeFromPath("/"), undefined);
    assert.equal(userTypeFromPath("/employers-info"), undefined);
  });
});

describe("readConsent", () => {
  const store = (v: string | null) => ({ getItem: () => v });
  it("returns stored granted/denied and unset for anything else", () => {
    assert.equal(readConsent(store("granted")), "granted");
    assert.equal(readConsent(store("denied")), "denied");
    assert.equal(readConsent(store(null)), "unset");
    assert.equal(readConsent(store("yes")), "unset");
  });

  it("returns unset when storage throws or is missing", () => {
    assert.equal(
      readConsent({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
      "unset",
    );
    assert.equal(readConsent(), "unset");
  });
});

describe("writeConsent", () => {
  it("stores the value under CONSENT_KEY", () => {
    const saved: Record<string, string> = {};
    writeConsent("granted", { setItem: (k, v) => void (saved[k] = v) });
    assert.deepEqual(saved, { [CONSENT_KEY]: "granted" });
  });

  it("does not throw when storage throws", () => {
    assert.doesNotThrow(() =>
      writeConsent("denied", {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    );
  });
});

describe("gaCookieExpiries / clearGaCookies", () => {
  it("expires _ga and _ga_<suffix> on the host and every parent domain with two or more labels", () => {
    const out = gaCookieExpiries("G-ABC123", "www.ifind.example.com");
    const names = ["_ga", "_ga_ABC123"];
    for (const name of names) {
      assert.ok(out.some((c) => c.startsWith(`${name}=;`) && !c.includes("domain=")), `${name} host-only`);
      for (const d of ["www.ifind.example.com", "ifind.example.com", "example.com"]) {
        assert.ok(out.some((c) => c.startsWith(`${name}=;`) && c.endsWith(`; domain=${d}`)), `${name} on ${d}`);
      }
      assert.ok(!out.some((c) => c.startsWith(`${name}=;`) && c.endsWith("; domain=com")));
    }
    assert.ok(out.every((c) => c.includes("path=/") && c.includes("max-age=0")));
    assert.equal(out.length, 8);
  });

  it("uses host-only expiry for localhost and IP hosts, and only _ga without a measurement id", () => {
    assert.equal(gaCookieExpiries("G-X", "localhost").length, 2);
    assert.equal(gaCookieExpiries("G-X", "127.0.0.1").length, 2);
    assert.deepEqual(gaCookieExpiries("", "localhost"), ["_ga=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT"]);
  });

  it("writes every expiry to the document and never throws", () => {
    const written: string[] = [];
    const doc = {
      set cookie(v: string) {
        written.push(v);
      },
      get cookie() {
        return "";
      },
    };
    clearGaCookies("G-ABC123", doc, "ifind.example.com");
    assert.deepEqual(written, gaCookieExpiries("G-ABC123", "ifind.example.com"));
    clearGaCookies("G-ABC123", undefined, "x.com");
    const throwing = {
      set cookie(_v: string) {
        throw new Error("blocked");
      },
      get cookie() {
        return "";
      },
    };
    assert.doesNotThrow(() => clearGaCookies("G-ABC123", throwing, "x.com"));
  });
});

describe("shouldLoadGa", () => {
  it("loads only when enabled, granted and outside the moderator area", () => {
    assert.equal(shouldLoadGa({ enabled: true, consent: "granted", pathname: "/" }), true);
    assert.equal(shouldLoadGa({ enabled: true, consent: "denied", pathname: "/" }), false);
    assert.equal(shouldLoadGa({ enabled: true, consent: "unset", pathname: "/" }), false);
    assert.equal(shouldLoadGa({ enabled: false, consent: "granted", pathname: "/" }), false);
    assert.equal(shouldLoadGa({ enabled: true, consent: "granted", pathname: "/moderator" }), false);
    assert.equal(shouldLoadGa({ enabled: true, consent: "granted", pathname: "/moderator/sam/usage" }), false);
    assert.equal(shouldLoadGa({ enabled: true, consent: "granted", pathname: "/moderatorx" }), true);
  });
});

describe("shouldShowBanner", () => {
  it("shows only when enabled, unset and outside the moderator area", () => {
    assert.equal(shouldShowBanner({ enabled: true, consent: "unset", pathname: "/" }), true);
    assert.equal(shouldShowBanner({ enabled: true, consent: "granted", pathname: "/" }), false);
    assert.equal(shouldShowBanner({ enabled: true, consent: "denied", pathname: "/" }), false);
    assert.equal(shouldShowBanner({ enabled: false, consent: "unset", pathname: "/" }), false);
    assert.equal(shouldShowBanner({ enabled: true, consent: "unset", pathname: "/moderator" }), false);
    assert.equal(shouldShowBanner({ enabled: true, consent: "unset", pathname: "/moderator/login" }), false);
  });
});

describe("trackWith", () => {
  type Call = [AnalyticsEvent, EventParams];
  const setup = (consent: "granted" | "denied" | "unset", pathname: string, enabled = true) => {
    const calls: Call[] = [];
    return { calls, deps: { enabled, consent, pathname, send: (n: AnalyticsEvent, p: EventParams) => void calls.push([n, p]) } };
  };

  it("does not send without consent", () => {
    const { calls, deps } = setup("denied", "/user/sam/browse");
    trackWith(deps, "view_internship", { internship_id: "1" });
    assert.equal(calls.length, 0);
  });

  it("does not send when tracking is disabled", () => {
    const { calls, deps } = setup("granted", "/user/sam/browse", false);
    trackWith(deps, "view_internship", { internship_id: "1" });
    assert.equal(calls.length, 0);
  });

  it("sends once with the user type derived from the path", () => {
    const { calls, deps } = setup("granted", "/user/sam/browse");
    trackWith(deps, "view_internship", { internship_id: "1" });
    assert.deepEqual(calls, [["view_internship", { user_type: "student", internship_id: "1" }]]);
  });

  it("lets an explicit user_type win", () => {
    const { calls, deps } = setup("granted", "/user/sam/browse");
    trackWith(deps, "login", { user_type: "employer" });
    assert.deepEqual(calls, [["login", { user_type: "employer" }]]);
  });

  it("does not send from the moderator area", () => {
    const { calls, deps } = setup("granted", "/moderator/x");
    trackWith(deps, "search", { result_count: 3 });
    assert.equal(calls.length, 0);
  });
});

describe("sanitizePagePath", () => {
  it("replaces the username segment under /user", () => {
    assert.equal(sanitizePagePath("/user/sam/browse"), "/user/:username/browse");
    assert.equal(sanitizePagePath("/user/sam"), "/user/:username");
    assert.equal(sanitizePagePath("/user/sam/overview?x=1#y"), "/user/:username/overview");
  });

  it("keeps the static login and register routes under /user", () => {
    assert.equal(sanitizePagePath("/user/login"), "/user/login");
    assert.equal(sanitizePagePath("/user/register"), "/user/register");
    assert.equal(sanitizePagePath("/user/login/"), "/user/login/");
    assert.equal(sanitizePagePath("/user/alice"), "/user/:username");
    assert.equal(sanitizePagePath("/user/alice/"), "/user/:username/");
    assert.equal(sanitizePagePath("/user/alice/login"), "/user/:username/login");
    assert.equal(sanitizeUrl("https://ifind.test/user/login?x=1", "https://ifind.test"), "https://ifind.test/user/login");
    assert.equal(sanitizeUrl("https://ifind.test/user/alice", "https://ifind.test"), "https://ifind.test/user/:username");
  });

  it("leaves other paths unchanged", () => {
    assert.equal(sanitizePagePath("/user"), "/user");
    assert.equal(sanitizePagePath("/"), "/");
    assert.equal(sanitizePagePath("/employer/companies/123/internships"), "/employer/companies/123/internships");
  });

  it("returns null for the moderator area", () => {
    assert.equal(sanitizePagePath("/moderator"), null);
    assert.equal(sanitizePagePath("/moderator/sam/usage"), null);
  });
});

describe("sanitizeUrl", () => {
  const origin = "https://ifind.test";
  it("sanitizes same-origin URLs and drops query and hash", () => {
    assert.equal(sanitizeUrl("https://ifind.test/user/sam/saved?x=1", origin), "https://ifind.test/user/:username/saved");
  });

  it("returns an empty string for moderator URLs and unparsable input", () => {
    assert.equal(sanitizeUrl("https://ifind.test/moderator/sam/usage", origin), "");
    assert.equal(sanitizeUrl("not a url", origin), "");
  });

  it("returns cross-origin URLs unchanged", () => {
    assert.equal(sanitizeUrl("https://www.google.com/search?q=intern", origin), "https://www.google.com/search?q=intern");
  });
});

describe("locationParams", () => {
  const origin = "https://ifind.test";
  it("sanitizes both the location and the same-origin referrer", () => {
    assert.deepEqual(
      locationParams("https://ifind.test/user/sam/browse?q=1#x", "https://ifind.test/user/sam/overview", origin),
      {
        page_location: "https://ifind.test/user/:username/browse",
        page_referrer: "https://ifind.test/user/:username/overview",
      },
    );
  });

  it("blanks a moderator location", () => {
    assert.equal(locationParams("https://ifind.test/moderator/sam/usage", "", origin).page_location, "");
  });

  it("keeps a cross-origin referrer and blanks an empty one", () => {
    assert.equal(locationParams("https://ifind.test/", "https://www.google.com/", origin).page_referrer, "https://www.google.com/");
    assert.equal(locationParams("https://ifind.test/", "", origin).page_referrer, "");
  });
});

describe("buildGtagEventParams", () => {
  it("adds sanitized location params and never leaks the username", () => {
    const out = buildGtagEventParams(
      { user_type: "student", internship_id: "1" },
      "https://ifind.test/user/sam/saved?tab=x#y",
      "https://ifind.test/user/sam/browse",
      "https://ifind.test",
    );
    assert.equal(out.user_type, "student");
    assert.equal(out.internship_id, "1");
    assert.equal(out.page_location, "https://ifind.test/user/:username/saved");
    assert.ok(!JSON.stringify(out).includes("sam"));
  });

  it("overrides any location the caller passed", () => {
    const out = buildGtagEventParams({}, "https://ifind.test/employer/x", "", "https://ifind.test");
    assert.equal(out.page_location, "https://ifind.test/employer/x");
    assert.equal(out.page_referrer, "");
  });
});

describe("clientIdFromCookie", () => {
  it("extracts the client id from the _ga cookie", () => {
    assert.equal(clientIdFromCookie("a=1; _ga=GA1.1.123456789.1700000000; b=2"), "123456789.1700000000");
    assert.equal(clientIdFromCookie("_ga=GA1.2.111.222"), "111.222");
  });

  it("returns null when missing or malformed", () => {
    assert.equal(clientIdFromCookie("a=1; b=2"), null);
    assert.equal(clientIdFromCookie("_ga=garbage"), null);
    assert.equal(clientIdFromCookie(null), null);
    assert.equal(clientIdFromCookie(undefined), null);
  });
});

describe("sessionIdFromCookie", () => {
  it("reads the session id from GS1 and GS2 cookies", () => {
    assert.equal(sessionIdFromCookie("_ga_ABC123=GS1.1.1700000001.5.1.1700000100.60.0.0", "G-ABC123"), "1700000001");
    assert.equal(sessionIdFromCookie("_ga_ABC123=GS2.1.s1700000002$o5$g1$t17$j60$l0$h0", "G-ABC123"), "1700000002");
  });

  it("returns null when absent or for another property", () => {
    assert.equal(sessionIdFromCookie("a=1", "G-ABC123"), null);
    assert.equal(sessionIdFromCookie("_ga_OTHER=GS1.1.1700000001.5.1.1.60.0.0", "G-ABC123"), null);
    assert.equal(sessionIdFromCookie(null, "G-ABC123"), null);
  });
});

describe("sendServerEvent", () => {
  const env = { NODE_ENV: "production", NEXT_PUBLIC_GA_ID: "G-TEST", GA_API_SECRET: "SECRET" };
  const req = (cookie?: string) => new Request("https://ifind.test/api/x", cookie ? { headers: { cookie } } : undefined);
  const recorder = (impl?: () => Promise<Response>) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return impl ? impl() : new Response(null, { status: 204 });
    }) as typeof fetch;
    return { calls, fake };
  };

  it("skips without a _ga cookie and never calls fetch", async () => {
    const { calls, fake } = recorder();
    assert.equal(await sendServerEvent(req(), "sign_up", { user_type: "student" }, { fetch: fake, env }), false);
    assert.equal(await sendServerEvent(req("a=1"), "sign_up", {}, { fetch: fake, env }), false);
    assert.equal(calls.length, 0);
  });

  it("posts the event to Measurement Protocol when consent cookie is present", async () => {
    const { calls, fake } = recorder();
    const ok = await sendServerEvent(req("_ga=GA1.1.1.2"), "sign_up", { user_type: "student" }, { fetch: fake, env });
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("https://www.google-analytics.com/mp/collect?"));
    assert.ok(calls[0].url.includes("measurement_id=G-TEST"));
    assert.ok(calls[0].url.includes("api_secret=SECRET"));
    assert.equal(calls[0].init?.method, "POST");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.client_id, "1.2");
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].name, "sign_up");
    assert.equal(body.events[0].params.user_type, "student");
    assert.equal(body.events[0].params.engagement_time_msec, 1);
    assert.equal(body.events[0].params.session_id, undefined);
  });

  it("includes the session id as a number and URL-encodes credentials", async () => {
    const { calls, fake } = recorder();
    const cookie = "_ga=GA1.1.1.2; _ga_TEST=GS1.1.1700000001.5.1.1700000100.60.0.0";
    await sendServerEvent(req(cookie), "login", {}, { fetch: fake, env: { NODE_ENV: "production", NEXT_PUBLIC_GA_ID: "G-TEST", GA_API_SECRET: "a&b=c" } });
    assert.ok(calls[0].url.includes("api_secret=a%26b%3Dc"));
    assert.equal(JSON.parse(String(calls[0].init?.body)).events[0].params.session_id, 1700000001);
  });

  it("sends only EventParams keys, never extra identifying values", async () => {
    const { calls, fake } = recorder();
    const params = { user_type: "employer", internship_id: "9", result_count: 3, email: "a@b.c", username: "sam" };
    await sendServerEvent(req("_ga=GA1.1.1.2"), "search", params as EventParams, { fetch: fake, env });
    const sent = JSON.parse(String(calls[0].init?.body)).events[0].params;
    assert.deepEqual(Object.keys(sent).sort(), ["engagement_time_msec", "internship_id", "result_count", "user_type"]);
  });

  it("does nothing outside production, even with a consent cookie and full env", async () => {
    const { calls, fake } = recorder();
    for (const NODE_ENV of ["development", "test", undefined]) {
      const devEnv = { ...env, NODE_ENV };
      assert.equal(await sendServerEvent(req("_ga=GA1.1.1.2"), "login", {}, { fetch: fake, env: devEnv }), false);
    }
    assert.equal(calls.length, 0);
  });

  it("returns false when env is missing", async () => {
    const { calls, fake } = recorder();
    assert.equal(await sendServerEvent(req("_ga=GA1.1.1.2"), "login", {}, { fetch: fake, env: {} }), false);
    assert.equal(await sendServerEvent(req("_ga=GA1.1.1.2"), "login", {}, { fetch: fake, env: { NODE_ENV: "production", NEXT_PUBLIC_GA_ID: "G-TEST" } }), false);
    assert.equal(calls.length, 0);
  });

  it("returns false and does not throw when fetch rejects or responds not ok", async () => {
    const rejecting = recorder(() => Promise.reject(new Error("boom")));
    assert.equal(await sendServerEvent(req("_ga=GA1.1.1.2"), "login", {}, { fetch: rejecting.fake, env }), false);
    const notOk = recorder(async () => new Response("no", { status: 500 }));
    assert.equal(await sendServerEvent(req("_ga=GA1.1.1.2"), "login", {}, { fetch: notOk.fake, env }), false);
    const throwing = (() => {
      throw new Error("sync");
    }) as unknown as typeof fetch;
    assert.equal(await sendServerEvent(req("_ga=GA1.1.1.2"), "login", {}, { fetch: throwing, env }), false);
  });
});

// ---- Reports (Data API shaping) ----

type FakeRow = { dims?: string[]; metrics: (string | number)[] };
type FakeRequest = {
  property?: string;
  dateRanges?: { startDate?: string; endDate?: string }[];
  dimensions?: { name?: string }[];
  metrics?: { name?: string }[];
  dimensionFilter?: {
    filter?: {
      fieldName?: string;
      inListFilter?: { values?: string[] };
      stringFilter?: { matchType?: string; value?: string };
    };
  };
  orderBys?: { desc?: boolean; metric?: { metricName?: string }; dimension?: { dimensionName?: string } }[];
  limit?: number | string;
};

const toResponse = (rows: FakeRow[]) => ({
  rows: rows.map((r) => ({
    dimensionValues: (r.dims ?? []).map((value) => ({ value })),
    metricValues: r.metrics.map((value) => ({ value: String(value) })),
  })),
});

/** Key a request by its dimensions ("" for none); "+f" marks a dimension filter, "@tu" a lone totalUsers metric. */
const requestKey = (req: FakeRequest) =>
  (req.dimensions ?? []).map((d) => d.name).join(",") +
  (req.dimensionFilter ? "+f" : "") +
  ((req.metrics ?? []).map((m) => m.name).join() === "totalUsers" ? "@tu" : "");

/** Fake GaClient. A response is rows, an Error to reject with, or absent (resolves to `[{}]`, no rows). */
function fakeGa(responses: Record<string, FakeRow[] | Error>) {
  const requests: FakeRequest[] = [];
  const realtime: FakeRequest[] = [];
  const reply = (r: FakeRow[] | Error | undefined) => {
    if (r instanceof Error) throw r;
    return [r ? toResponse(r) : {}];
  };
  const client = {
    runReport: async (req: FakeRequest) => {
      requests.push(req);
      return reply(responses[requestKey(req)]);
    },
    runRealtimeReport: async (req: FakeRequest) => {
      realtime.push(req);
      return reply(responses.realtime);
    },
  } as unknown as GaClient;
  const find = (key: string) => requests.find((r) => requestKey(r) === key);
  return { client, requests, realtime, find };
}

const metricNames = (req?: FakeRequest) => (req?.metrics ?? []).map((m) => m.name);

describe("computeFunnel", () => {
  it("orders the four steps and uses the union for the last one", () => {
    const f = computeFunnel({
      visitUsers: 100,
      eventUsers: { sign_up: 20, view_internship: 50, apply_click: 8, application_submitted: 4 },
      appliedUnionUsers: 10,
    });
    assert.deepEqual(
      f.steps.map((s) => s.users),
      [100, 20, 50, 10],
    );
    assert.deepEqual(
      f.steps.map((s) => s.key),
      ["visit", "sign_up", "view_internship", "applied"],
    );
    assert.deepEqual(
      f.steps.map((s) => s.label),
      ["Visited", "Signed up", "Viewed an internship", "Applied"],
    );
    assert.equal(f.applyClickUsers, 8);
    assert.equal(f.applicationSubmittedUsers, 4);
  });

  it("counts missing event keys as 0", () => {
    const f = computeFunnel({ visitUsers: 5, eventUsers: {}, appliedUnionUsers: 0 });
    assert.deepEqual(
      f.steps.map((s) => s.users),
      [5, 0, 0, 0],
    );
    assert.equal(f.applyClickUsers, 0);
    assert.equal(f.applicationSubmittedUsers, 0);
  });
});

describe("fetchOverviewReport", () => {
  it("returns zeros and empty lists when responses have no rows", async () => {
    const { client } = fakeGa({});
    const r = await fetchOverviewReport(client, "123", "7d");
    assert.deepEqual(r.kpis, { activeUsers: 0, sessions: 0, newUsers: 0, pageviews: 0 });
    assert.deepEqual(r.daily, []);
    assert.deepEqual(r.sources, []);
    assert.deepEqual(r.topPages, []);
    assert.deepEqual(r.devices, []);
    assert.deepEqual(r.countries, []);
    assert.deepEqual(r.topInternships, []);
    assert.deepEqual(
      r.funnel.steps.map((s) => s.users),
      [0, 0, 0, 0],
    );
  });

  it("shapes every section from rows and sends the specified requests", async () => {
    const { client, requests, find } = fakeGa({
      "": [{ metrics: [40, 55, 12, 300] }],
      date: [
        { dims: ["20261019"], metrics: [7, 9] },
        { dims: ["20261020"], metrics: [3, 4] },
      ],
      sessionDefaultChannelGroup: [{ dims: ["Organic Search"], metrics: [30] }],
      pagePath: [{ dims: ["/internships"], metrics: [120] }],
      deviceCategory: [{ dims: ["mobile"], metrics: [25] }],
      country: [{ dims: ["India"], metrics: [33] }],
      "eventName+f@tu": [
        { dims: ["sign_up"], metrics: [20] },
        { dims: ["view_internship"], metrics: [50] },
        { dims: ["apply_click"], metrics: [8] },
        { dims: ["application_submitted"], metrics: [4] },
      ],
    });
    const r = await fetchOverviewReport(client, "123", "30d");
    assert.deepEqual(r.daily, [
      { date: "2026-10-19", users: 7, sessions: 9 },
      { date: "2026-10-20", users: 3, sessions: 4 },
    ]);
    assert.deepEqual(r.sources, [{ channel: "Organic Search", users: 30 }]);
    assert.deepEqual(r.topPages, [{ path: "/internships", views: 120 }]);
    assert.deepEqual(r.devices, [{ device: "mobile", users: 25 }]);
    assert.deepEqual(r.countries, [{ country: "India", users: 33 }]);
    assert.equal(r.funnel.steps[1].users, 20);
    assert.equal(r.funnel.steps[2].users, 50);
    assert.equal(r.funnel.applyClickUsers, 8);
    assert.equal(r.funnel.applicationSubmittedUsers, 4);

    // Every request targets the property and the selected range.
    for (const req of requests) {
      assert.equal(req.property, "properties/123");
      assert.deepEqual(req.dateRanges, [{ startDate: "29daysAgo", endDate: "today" }]);
    }
    assert.deepEqual(metricNames(find("")), ["activeUsers", "sessions", "newUsers", "screenPageViews"]);
    const visit = find("@tu");
    assert.equal(visit?.dimensions, undefined);
    assert.equal(visit?.dimensionFilter, undefined);
    const daily = find("date");
    assert.deepEqual(metricNames(daily), ["activeUsers", "sessions"]);
    assert.equal(daily?.orderBys?.[0].dimension?.dimensionName, "date");
    assert.notEqual(daily?.orderBys?.[0].desc, true);
    for (const [dim, metric] of [
      ["sessionDefaultChannelGroup", "activeUsers"],
      ["pagePath", "screenPageViews"],
      ["deviceCategory", "activeUsers"],
      ["country", "activeUsers"],
    ]) {
      const req = find(dim);
      assert.deepEqual(metricNames(req), [metric], dim);
      assert.equal(Number(req?.limit), 10, dim);
      assert.equal(req?.orderBys?.[0].metric?.metricName, metric, dim);
      assert.equal(req?.orderBys?.[0].desc, true, dim);
    }
    const internships = requests.find((q) => requestKey(q) === "customEvent:internship_id+f");
    assert.deepEqual(metricNames(internships), ["eventCount"]);
    assert.equal(internships?.dimensionFilter?.filter?.fieldName, "eventName");
    assert.equal(internships?.dimensionFilter?.filter?.stringFilter?.value, "view_internship");
    assert.equal(internships?.dimensionFilter?.filter?.stringFilter?.matchType, "EXACT");
    assert.equal(internships?.orderBys?.[0].desc, true);
    assert.equal(Number(internships?.limit), 10);
    const events = find("eventName+f@tu");
    assert.deepEqual(metricNames(events), ["totalUsers"]);
    assert.deepEqual(events?.dimensionFilter?.filter?.inListFilter?.values?.slice().sort(), [
      "application_submitted",
      "apply_click",
      "sign_up",
      "view_internship",
    ]);
  });

  it("computes the applied step from the union query, not by adding the two events", async () => {
    const { client, find } = fakeGa({
      "@tu": [{ metrics: [100] }],
      "+f@tu": [{ metrics: [10] }],
      "eventName+f@tu": [
        { dims: ["apply_click"], metrics: [8] },
        { dims: ["application_submitted"], metrics: [4] },
      ],
    });
    const r = await fetchOverviewReport(client, "1", "7d");
    assert.equal(r.funnel.steps[3].users, 10);
    assert.equal(r.funnel.steps[0].users, 100);
    const union = find("+f@tu");
    assert.deepEqual(metricNames(union), ["totalUsers"]);
    assert.deepEqual(union?.dimensionFilter?.filter?.inListFilter?.values?.slice().sort(), [
      "application_submitted",
      "apply_click",
    ]);
  });

  it("leaves topInternships null when only the custom-dimension request rejects", async () => {
    const { client } = fakeGa({
      "": [{ metrics: [40, 55, 12, 300] }],
      pagePath: [{ dims: ["/a"], metrics: [9] }],
      "customEvent:internship_id+f": new Error("Field customEvent:internship_id is not a valid dimension"),
    });
    const r = await fetchOverviewReport(client, "1", "7d");
    assert.equal(r.topInternships, null);
    assert.deepEqual(r.topPages, [{ path: "/a", views: 9 }]);
    assert.equal(r.kpis.activeUsers, 40);
  });

  it("shapes topInternships from rows", async () => {
    const { client } = fakeGa({ "customEvent:internship_id+f": [{ dims: ["abc"], metrics: [14] }] });
    const r = await fetchOverviewReport(client, "1", "7d");
    assert.deepEqual(r.topInternships, [{ internshipId: "abc", views: 14 }]);
  });

  it("converts the YYYYMMDD date dimension to YYYY-MM-DD", async () => {
    const { client } = fakeGa({ date: [{ dims: ["20261019"], metrics: [1, 2] }] });
    const r = await fetchOverviewReport(client, "1", "7d");
    assert.equal(r.daily[0].date, "2026-10-19");
  });

  it("rejects when a required (non-custom) request fails", async () => {
    const { client } = fakeGa({ country: new Error("quota") });
    await assert.rejects(fetchOverviewReport(client, "1", "7d"), /quota/);
  });
});

describe("fetchRealtime", () => {
  it("returns 0 active users when the response has no rows", async () => {
    const { client } = fakeGa({});
    assert.deepEqual(await fetchRealtime(client, "123"), { activeUsers: 0 });
  });

  it("reads activeUsers and targets the property", async () => {
    const { client, realtime } = fakeGa({ realtime: [{ metrics: [6] }] });
    assert.deepEqual(await fetchRealtime(client, "123"), { activeUsers: 6 });
    assert.equal(realtime[0].property, "properties/123");
    assert.deepEqual(metricNames(realtime[0]), ["activeUsers"]);
  });
});

/** In-memory CacheStore that records every `set` with its TTL. */
function fakeStore(opts: { getThrows?: boolean; setThrows?: boolean } = {}) {
  const data = new Map<string, unknown>();
  const sets: { key: string; value: unknown; ttl: number }[] = [];
  const gets: string[] = [];
  const store: CacheStore = {
    get: async (key) => {
      gets.push(key);
      if (opts.getThrows) throw new Error("redis down");
      return data.has(key) ? data.get(key) : null;
    },
    set: async (key, value, ttl) => {
      if (opts.setThrows) throw new Error("redis down");
      sets.push({ key, value, ttl });
      data.set(key, value);
    },
  };
  return { store, data, sets, gets };
}

describe("cachedReport", () => {
  it("serves a cache hit without calling the fetcher", async () => {
    const { store, data } = fakeStore();
    data.set("t:hit", { data: { n: 1 }, fetchedAt: "2026-01-01T00:00:00.000Z" });
    let calls = 0;
    const r = await cachedReport({ key: "t:hit", ttlSeconds: 300, store, fetcher: async () => (calls++, { n: 2 }) });
    assert.equal(calls, 0);
    assert.deepEqual(r.data, { n: 1 });
    assert.equal(r.stale, false);
  });

  it("on a miss fetches once and writes the TTL copy and the 24 h last-good copy", async () => {
    const { store, sets } = fakeStore();
    let calls = 0;
    const r = await cachedReport({ key: "t:miss", ttlSeconds: 300, store, fetcher: async () => (calls++, { n: 3 }) });
    assert.equal(calls, 1);
    assert.deepEqual(r.data, { n: 3 });
    assert.equal(r.stale, false);
    assert.ok(!Number.isNaN(Date.parse(r.fetchedAt)));
    const ttlOf = (key: string) => sets.find((s) => s.key === key)?.ttl;
    assert.equal(ttlOf("t:miss"), 300);
    assert.equal(ttlOf("t:miss:last"), 86400);
  });

  it("keeps the original fetchedAt on hits and on stale fallbacks", async () => {
    const { store, data } = fakeStore();
    data.set("t:env", { data: { n: 10 }, fetchedAt: "2026-01-01T00:00:00.000Z" });
    const hit = await cachedReport({ key: "t:env", ttlSeconds: 300, store, fetcher: async () => ({ n: 0 }) });
    assert.equal(hit.fetchedAt, "2026-01-01T00:00:00.000Z");
    data.set("t:env2:last", { data: { n: 11 }, fetchedAt: "2026-01-02T00:00:00.000Z" });
    const stale = await cachedReport({
      key: "t:env2",
      ttlSeconds: 300,
      store,
      fetcher: async () => {
        throw new Error("google down");
      },
    });
    assert.deepEqual(stale.data, { n: 11 });
    assert.equal(stale.fetchedAt, "2026-01-02T00:00:00.000Z");
  });

  const malformed: [string, unknown][] = [
    ["a string", "oops"],
    ["a number", 42],
    ["an array", [1, 2]],
    ["an empty object", {}],
    ["an envelope with null data", { data: null, fetchedAt: "x" }],
    ["an envelope without fetchedAt", { data: { n: 1 } }],
  ];
  for (const [label, bad] of malformed) {
    it(`treats ${label} from the store as a miss and fetches fresh data`, async () => {
      const { store, data } = fakeStore();
      const key = `t:bad:${label}`;
      data.set(key, bad);
      let calls = 0;
      const r = await cachedReport({ key, ttlSeconds: 300, store, fetcher: async () => (calls++, { n: 12 }) });
      assert.equal(calls, 1);
      assert.deepEqual(r.data, { n: 12 });
      assert.equal(r.stale, false);
    });

    it(`does not invent a stale copy from ${label} at :last`, async () => {
      const { store, data } = fakeStore();
      const key = `t:badlast:${label}`;
      data.set(`${key}:last`, bad);
      await assert.rejects(
        cachedReport({
          key,
          ttlSeconds: 300,
          store,
          fetcher: async () => {
            throw new Error("google down");
          },
        }),
        /google down/,
      );
    });
  }

  it("falls through to the fetcher when the store read throws", async () => {
    const { store } = fakeStore({ getThrows: true });
    let calls = 0;
    const r = await cachedReport({ key: "t:getthrows", ttlSeconds: 300, store, fetcher: async () => (calls++, { n: 4 }) });
    assert.equal(calls, 1);
    assert.deepEqual(r.data, { n: 4 });
    assert.equal(r.stale, false);
  });

  it("still returns data when the store write throws", async () => {
    const { store } = fakeStore({ setThrows: true });
    const r = await cachedReport({ key: "t:setthrows", ttlSeconds: 300, store, fetcher: async () => ({ n: 5 }) });
    assert.deepEqual(r.data, { n: 5 });
  });

  it("calls the fetcher directly when there is no store", async () => {
    const r = await cachedReport({ key: "t:nostore", ttlSeconds: 300, store: null, fetcher: async () => ({ n: 6 }) });
    assert.deepEqual(r.data, { n: 6 });
    assert.equal(r.stale, false);
  });

  it("serves the last-good copy as stale when the fetcher fails", async () => {
    const { store, data } = fakeStore();
    data.set("t:stale:last", { data: { n: 7 }, fetchedAt: "2026-01-01T00:00:00.000Z" });
    const r = await cachedReport({
      key: "t:stale",
      ttlSeconds: 300,
      store,
      fetcher: async () => {
        throw new Error("google down");
      },
    });
    assert.deepEqual(r.data, { n: 7 });
    assert.equal(r.stale, true);
  });

  it("rejects when the fetcher fails and there is no last-good copy", async () => {
    const { store } = fakeStore();
    await assert.rejects(
      cachedReport({
        key: "t:nolast",
        ttlSeconds: 300,
        store,
        fetcher: async () => {
          throw new Error("google down");
        },
      }),
      /google down/,
    );
  });

  it("rejects when the fetcher fails and there is no store", async () => {
    await assert.rejects(
      cachedReport({
        key: "t:nolast-nostore",
        ttlSeconds: 300,
        store: null,
        fetcher: async () => {
          throw new Error("google down");
        },
      }),
      /google down/,
    );
  });

  it("shares one fetcher call between concurrent callers on a cold key", async () => {
    const { store } = fakeStore();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return { n: 8 };
    };
    const [a, b] = await Promise.all([
      cachedReport({ key: "t:flight", ttlSeconds: 300, store, fetcher }),
      cachedReport({ key: "t:flight", ttlSeconds: 300, store, fetcher }),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(a.data, { n: 8 });
    assert.deepEqual(b.data, { n: 8 });
  });

  it("clears the in-flight entry after a rejection so a later call retries", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return { n: 9 };
    };
    await assert.rejects(cachedReport({ key: "t:retry", ttlSeconds: 300, store: null, fetcher }), /boom/);
    const r = await cachedReport({ key: "t:retry", ttlSeconds: 300, store: null, fetcher });
    assert.deepEqual(r.data, { n: 9 });
    assert.equal(calls, 2);
  });
});

describe("redisStore", () => {
  it("is null when either Upstash variable is unset or blank", () => {
    assert.equal(redisStore({}), null);
    assert.equal(redisStore({ UPSTASH_REDIS_REST_URL: "https://x.upstash.io" }), null);
    assert.equal(redisStore({ UPSTASH_REDIS_REST_TOKEN: "t" }), null);
    assert.equal(redisStore({ UPSTASH_REDIS_REST_URL: "  ", UPSTASH_REDIS_REST_TOKEN: "t" }), null);
  });

  it("builds a store when both variables are set (no network until used)", () => {
    const s = redisStore({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" });
    assert.equal(typeof s?.get, "function");
    assert.equal(typeof s?.set, "function");
  });
});

describe("withTimeout", () => {
  it("rejects a never-settling operation within the timeout", async () => {
    const started = Date.now();
    await assert.rejects(withTimeout(new Promise<never>(() => {}), 30), /timed out/);
    assert.ok(Date.now() - started < 500);
  });

  it("passes through the value or the error of an operation that settles in time", async () => {
    assert.equal(await withTimeout(Promise.resolve(7), 1000), 7);
    await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 1000), /boom/);
  });

  it("lets cachedReport treat a hanging store as a miss and a skipped write", async () => {
    const hanging: CacheStore = {
      get: () => withTimeout(new Promise<never>(() => {}), 20),
      set: () => withTimeout(new Promise<never>(() => {}), 20),
    };
    const r = await cachedReport({ key: "hang:test", ttlSeconds: 1, store: hanging, fetcher: async () => ({ n: 1 }) });
    assert.deepEqual(r.data, { n: 1 });
    assert.equal(r.stale, false);
  });
});

describe("getAnalytics", () => {
  const SA = { client_email: "sa@example.iam.gserviceaccount.com", private_key: "SECRET-KEY-MATERIAL" };
  const validEnv = { GA_PROPERTY_ID: "123", GA_SERVICE_ACCOUNT_B64: b64(JSON.stringify(SA)) };
  const noCreate = () => {
    throw new Error("createClient must not be called");
  };

  it("reports both missing variable names when env is empty and touches nothing", async () => {
    const { store, gets } = fakeStore();
    const r = await getAnalytics({ view: "overview", range: "7d", env: {}, store, createClient: noCreate });
    assert.deepEqual(r, { configured: false, missing: ["GA_PROPERTY_ID", "GA_SERVICE_ACCOUNT_B64"] });
    assert.equal(gets.length, 0);
  });

  it("treats a malformed service account as not configured without leaking it", async () => {
    const env = { GA_PROPERTY_ID: "123", GA_SERVICE_ACCOUNT_B64: "not-base64-json!!" };
    const r = await getAnalytics({ view: "overview", range: "7d", env, store: null, createClient: noCreate });
    assert.equal(r.configured, false);
    if (!r.configured) assert.ok(r.missing.includes("GA_SERVICE_ACCOUNT_B64"));
    assert.ok(!JSON.stringify(r).includes("not-base64-json"));
  });

  it("returns an overview report with a fake client and no store", async () => {
    const { client } = fakeGa({});
    let received: { client_email: string; private_key: string } | undefined;
    const r = await getAnalytics({
      view: "overview",
      range: "30d",
      env: validEnv,
      store: null,
      createClient: (sa) => {
        received = sa;
        return client;
      },
    });
    assert.deepEqual(received, SA);
    assert.equal(r.configured, true);
    if (r.configured) {
      assert.equal(r.view, "overview");
      assert.equal(r.range, "30d");
      assert.equal(r.stale, false);
      assert.ok("kpis" in r.report);
      assert.ok(!JSON.stringify(r).includes("SECRET-KEY-MATERIAL"));
    }
  });

  it("caches overview under ga:{property}:overview:{range} for 300 s and realtime under ga:{property}:realtime:now for 60 s", async () => {
    const { client } = fakeGa({ realtime: [{ metrics: [4] }] });
    const { store, sets } = fakeStore();
    await getAnalytics({ view: "overview", range: "90d", env: validEnv, store, createClient: () => client });
    const rt = await getAnalytics({ view: "realtime", range: "today", env: validEnv, store, createClient: () => client });
    const ttlOf = (key: string) => sets.find((s) => s.key === key)?.ttl;
    assert.equal(ttlOf("ga:123:overview:90d"), 300);
    assert.equal(ttlOf("ga:123:overview:90d:last"), 86400);
    assert.equal(ttlOf("ga:123:realtime:now"), 60);
    assert.equal(ttlOf("ga:123:realtime:now:last"), 86400);
    assert.equal(rt.configured && rt.view === "realtime", true);
    if (rt.configured) assert.deepEqual(rt.report, { activeUsers: 4 });
  });

  it("keys the cache by property so a property change cannot serve the old property's data", async () => {
    const { client } = fakeGa({});
    const { store, sets } = fakeStore();
    const env456 = { ...validEnv, GA_PROPERTY_ID: " 456 " };
    await getAnalytics({ view: "overview", range: "7d", env: env456, store, createClient: () => client });
    assert.ok(sets.some((x) => x.key === "ga:456:overview:7d"));
    assert.ok(!sets.some((x) => x.key.includes("123")));
  });
});
