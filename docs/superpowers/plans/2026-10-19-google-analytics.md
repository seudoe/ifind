# Google Analytics in the Moderator Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect GA4 data (consent-gated browser tag plus server-side events) and show it in a new "Analytics" moderator tab fed by the GA Data API, cached in Upstash Redis.

**Architecture:** Pure, injectable modules under `lib/analytics/` (config, consent, tracking, Measurement Protocol, cache, report shaping, service) tested with `tsx --test`. Thin wiring in existing routes and components. One moderator API route calls the service; one client panel renders it.

**Tech Stack:** Next 16.3 (modified, read `node_modules/next/dist/docs/` before touching Next APIs), React 19, TypeScript, `@next/third-parties/google`, `@google-analytics/data`, `@upstash/redis`, `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-19-google-analytics-design.md`

## Global Constraints

- Tag loads only when `NODE_ENV === "production"` **and** `NEXT_PUBLIC_GA_ID` is non-empty, **and** consent is `granted`, **and** the path is not `/moderator` or `/moderator/*`.
- No user ID, email, username, filename or search text is ever sent to Google. Only `user_type` (`student` | `employer`), `internship_id`, `result_count`.
- Server-side events are sent only when the request carries a `_ga` cookie. Each event is sent from exactly one side: server = `sign_up`, `login`, `application_submitted`, `internship_posted`; client = `view_internship`, `apply_click`, `save_internship`, `search`, `resume_uploaded`.
- `GA_SERVICE_ACCOUNT_B64`, `GA_API_SECRET`, Upstash token: server only, never in a `NEXT_PUBLIC_` variable or a response body. Error responses list env var **names** only.
- Moderator API gate, copied from `app/api/moderator/usage/route.ts`: `getModSession()` and `session.isVerified`, else `403 { success: false, error: "Forbidden" }`. Node runtime.
- Cache: key `ga:{report}:{range}`, TTL 300 s; realtime TTL 60 s; last-good copy at `{key}:last`, TTL 86400 s. Ranges: `today`, `7d`, `30d`, `90d`.
- Funnel steps: visit → `sign_up` → `view_internship` → applied, where applied = users with `apply_click` **or** `application_submitted`.
- Tests: `node:test` style as in `tests/usage.test.ts`, relative imports, no network. Branch `feature/google-analytics`; commit, never push.

## Review Focus

Failure modes the spec implies that are most likely to bite, each pinned by a test in the named task:

1. `localStorage` throws or is missing → treated as "not accepted", no crash (Task 2).
2. Visitor declined consent → no `_ga` cookie → server event skipped, never throws (Task 3).
3. New property returns no `rows` → zeros and empty lists, not a crash (Task 5).
4. A user who did both `apply_click` and `application_submitted` counts once in the funnel's last step (Task 5).
5. `GA_SERVICE_ACCOUNT_B64` malformed → "not configured" result naming the variable, not a 500 (Task 1, Task 6).

## File Structure

| File | Responsibility |
|---|---|
| `lib/analytics/events.ts` (new) | Event names, `UserType`, `EventParams`, `userTypeFromPath` |
| `lib/analytics/config.ts` (new) | Ranges, `trackingEnabled`, `missingEnv`, `parseServiceAccount` |
| `lib/analytics/consent.ts` (new) | Consent storage + `shouldLoadGa` / `shouldShowBanner` |
| `lib/analytics/track.ts` (new) | Client `track()` (consent-checked) |
| `components/analytics/AnalyticsProvider.tsx`, `ConsentBanner.tsx` (new) | Banner + GA tag mount |
| `lib/analytics/measurementProtocol.ts` (new) | Server events: cookie parsing + send |
| `lib/analytics/cache.ts`, `redis.ts` (new) | `cachedReport`, Upstash-backed `CacheStore` |
| `lib/analytics/reports.ts` (new) | Data API queries and pure shapers, funnel |
| `lib/analytics/service.ts` (new) | `getAnalytics`: config check, cache, fetch |
| `app/api/moderator/analytics/route.ts` (new) | Thin gated GET |
| `app/moderator/[username]/analytics/page.tsx`, `components/moderator/AnalyticsPanel.tsx` (new) | Tab UI |
| `components/moderator/ModeratorShell.tsx` (modify) | New nav entry |
| `tests/analytics.test.ts` (new), `package.json` (modify) | Tests, `test:analytics` script |
| `docs/ANALYTICS.md` (new) | Env vars and manual GA steps |

Known limitation to keep in `docs/ANALYTICS.md`: Measurement Protocol events lack GA's automatic attribution unless `session_id` is passed; Task 3 passes it when the `_ga_<id>` cookie is present.

---

### Task 1: Dependencies, events, config

**Files:**
- Modify: `package.json` (deps + `"test:analytics": "tsx --test tests/analytics.test.ts"`)
- Create: `lib/analytics/events.ts`, `lib/analytics/config.ts`, `tests/analytics.test.ts`

**Interfaces:**
- Produces (`events.ts`): `ANALYTICS_EVENTS` (the nine names, `as const`), `type AnalyticsEvent`, `type UserType = "student" | "employer"`, `interface EventParams { user_type?: UserType; internship_id?: string; result_count?: number }`, `userTypeFromPath(pathname: string): UserType | undefined`.
- Produces (`config.ts`): `RANGES = ["today","7d","30d","90d"] as const`, `type RangeKey`, `parseRange(v: string | null): RangeKey | null`, `rangeToGaDates(r: RangeKey): { startDate: string; endDate: string }`, `trackingEnabled(env: { NODE_ENV?: string; NEXT_PUBLIC_GA_ID?: string }): boolean`, `missingEnv(env: Record<string, string | undefined>, scope: "dashboard" | "events"): string[]`, `parseServiceAccount(b64: string): { client_email: string; private_key: string } | null`.

- [ ] **Step 1:** `npm install @next/third-parties @google-analytics/data @upstash/redis`; add the `test:analytics` script.
- [ ] **Step 2: Write failing tests** in `tests/analytics.test.ts` (import from `../lib/analytics/...`):
  - `parseRange("7d") === "7d"`, `parseRange("1y") === null`, `parseRange(null) === null`.
  - `rangeToGaDates`: `today` → `{startDate:"today",endDate:"today"}`; `7d` → `6daysAgo`/`today`; `30d` → `29daysAgo`; `90d` → `89daysAgo`.
  - `trackingEnabled`: true for `{NODE_ENV:"production",NEXT_PUBLIC_GA_ID:"G-X"}`; false for `development`, for `""`, for `"  "`.
  - `missingEnv({}, "dashboard")` deep-equals `["GA_PROPERTY_ID","GA_SERVICE_ACCOUNT_B64"]`; `missingEnv({}, "events")` → `["NEXT_PUBLIC_GA_ID","GA_API_SECRET"]`; all set → `[]`.
  - `parseServiceAccount`: valid base64 of `{"client_email":"a@b.iam.gserviceaccount.com","private_key":"k"}` returns both fields; `"%%%"`, base64 of `{}`, and base64 of non-JSON all return `null`.
  - `userTypeFromPath`: `/employer/companies` → `employer`; `/user/sam/browse` → `student`; `/` → `undefined`; `/employers-info` → `undefined`.
- [ ] **Step 3:** Run `npm run test:analytics`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement both files. `parseServiceAccount` never throws.
- [ ] **Step 5:** Run `npm run test:analytics`. Expected: PASS.
- [ ] **Step 6:** `git add package.json package-lock.json lib/analytics tests/analytics.test.ts && git commit -m "feat(analytics): events, config and env helpers"`

### Task 2: Consent, client tracking, banner, GA tag

**Files:**
- Create: `lib/analytics/consent.ts`, `lib/analytics/track.ts`, `components/analytics/ConsentBanner.tsx`, `components/analytics/AnalyticsProvider.tsx`
- Modify: `app/layout.tsx` (mount `<AnalyticsProvider />` inside `<body>` after `<Toaster />`), `tests/analytics.test.ts`

**Interfaces:**
- Consumes: Task 1 `trackingEnabled`, `userTypeFromPath`, `AnalyticsEvent`, `EventParams`.
- Produces (`consent.ts`): `type Consent = "granted" | "denied" | "unset"`, `CONSENT_KEY = "ifind_analytics_consent"`, `readConsent(storage?: Pick<Storage,"getItem">): Consent`, `writeConsent(value: "granted" | "denied", storage?: Pick<Storage,"setItem">): void`, `shouldLoadGa(a: { enabled: boolean; consent: Consent; pathname: string }): boolean`, `shouldShowBanner(a: same): boolean`.
- Produces (`track.ts`): `trackWith(deps: { enabled: boolean; consent: Consent; pathname: string; send: (name: AnalyticsEvent, params: EventParams) => void }, event: AnalyticsEvent, params?: EventParams): void`; `track(event: AnalyticsEvent, params?: EventParams): void` reads the real globals (`localStorage`, `location.pathname`, `process.env`) and sends via `sendGAEvent` from `@next/third-parties/google`.

- [ ] **Step 1: Write failing tests:**
  - `readConsent`: storage returning `"granted"`/`"denied"` → same; `null` and `"yes"` → `"unset"`; `getItem` throwing → `"unset"`; no storage → `"unset"`.
  - `writeConsent` with a throwing `setItem` does not throw; with a fake storage it stores under `CONSENT_KEY`.
  - `shouldLoadGa`: true only for enabled + granted + `"/"`; false for denied, unset, disabled, `"/moderator"`, `"/moderator/sam/usage"`; true for `"/moderatorx"`.
  - `shouldShowBanner`: true for enabled + unset + `"/"`; false for granted, denied, disabled, any `/moderator` path.
  - `trackWith`: consent `denied` → `send` not called; `granted` with pathname `/user/sam/browse` → `send` called once with `("view_internship", { user_type: "student", internship_id: "1" })`; an explicit `user_type` in params wins; `/moderator/x` → not called.
- [ ] **Step 2:** Run `npm run test:analytics`. Expected: FAIL.
- [ ] **Step 3:** Implement `consent.ts` and `track.ts` (every storage access in try/catch).
- [ ] **Step 4:** Implement `AnalyticsProvider` (`"use client"`; read consent in an effect to avoid hydration mismatch; `usePathname()`; renders `<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />` when `shouldLoadGa`, and `<ConsentBanner onChoose={...} />` when `shouldShowBanner`). `ConsentBanner`: fixed bottom bar, Accept / Decline buttons using existing `Button` and CSS variables; calls `writeConsent` then the callback. Check the `@next/third-parties` guide in `node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md` for the exact `GoogleAnalytics` props.
- [ ] **Step 5:** Run tests (PASS), then `npx tsc --noEmit` (no new errors).
- [ ] **Step 6:** Manual: `npm run build && npm start`, set `NODE_ENV` production build locally with the ID present; confirm the banner shows on `/`, not on `/moderator/login`; Accept loads `googletagmanager.com/gtag/js`; Decline does not; reload keeps the choice.
- [ ] **Step 7:** Commit `feat(analytics): consent banner and gated GA tag`.

### Task 3: Server-side events module

**Files:**
- Create: `lib/analytics/measurementProtocol.ts`
- Modify: `tests/analytics.test.ts`

**Interfaces:**
- Consumes: Task 1 `AnalyticsEvent`, `EventParams`, `missingEnv`.
- Produces: `clientIdFromCookie(cookieHeader: string | null | undefined): string | null`, `sessionIdFromCookie(cookieHeader: string | null | undefined, measurementId: string): string | null`, `sendServerEvent(req: Request, name: AnalyticsEvent, params?: EventParams, deps?: { fetch?: typeof fetch; env?: Record<string, string | undefined> }): Promise<boolean>`. Never throws; `false` means skipped or failed.

- [ ] **Step 1: Write failing tests:**
  - `clientIdFromCookie("a=1; _ga=GA1.1.123456789.1700000000; b=2")` → `"123456789.1700000000"`; `"_ga=GA1.2.111.222"` → `"111.222"`; no `_ga`, `"_ga=garbage"`, `null` → `null`.
  - `sessionIdFromCookie("_ga_ABC123=GS1.1.1700000001.5.1.1700000100.60.0.0", "G-ABC123")` → `"1700000001"`; `"_ga_ABC123=GS2.1.s1700000002$o5$g1$t17$j60$l0$h0"` → `"1700000002"`; absent → `null`.
  - `sendServerEvent`: request without `_ga` → returns `false`, fake `fetch` never called. With cookie `_ga=GA1.1.1.2` and env `{NEXT_PUBLIC_GA_ID:"G-TEST",GA_API_SECRET:"SECRET"}` → `true`; the single fetch URL contains `measurement_id=G-TEST` and `api_secret=SECRET`; parsed JSON body has `client_id "1.2"` and `events[0]` with `name "sign_up"` and `params.user_type "student"`, `engagement_time_msec` 1. Env missing → `false`. Fetch rejecting, and fetch resolving `ok:false` → `false`, no throw.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement. POST to `https://www.google-analytics.com/mp/collect` with a 2 s `AbortSignal.timeout`; include `session_id` (as a number) when found. Callers `await` it (serverless functions can stop after responding; check the Next docs for `after` before choosing otherwise).
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(analytics): Measurement Protocol server events`.

### Task 4: Wire server-side events

**Files (modify):** `app/api/auth/register/route.ts` (~line 86), `app/api/auth/login/route.ts` (~102), `app/api/employer/auth/register/route.ts` (~44), `app/api/employer/auth/login/route.ts` (~39), `app/api/auth/linkedin/callback/route.ts` (employer branch ~157; student branch ~293), `app/api/internships/[id]/apply/route.ts`, `app/api/employer/companies/[companyId]/internships/route.ts` (POST, ~67)

**Interfaces:** Consumes Task 3 `sendServerEvent`.

- [ ] **Step 1:** In each route, `await sendServerEvent(request, <event>, { user_type })` immediately before the success `return`, so a failure can never change the response (the helper never throws).
  - Student/employer register → `sign_up`; student/employer login → `login`.
  - LinkedIn callback: `sign_up` when the account was created in this request, otherwise `login`; for employer and student branches. The employer "link LinkedIn to existing account" branch (~line 109) sends nothing.
  - Apply route: `application_submitted` (`user_type: "student"`) only on the iFind-native path after `createApplication` succeeds. The scraped-listing path sends nothing (the client fires `apply_click`).
  - Employer internship POST → `internship_posted` (`user_type: "employer"`).
  - Moderator login: no event.
- [ ] **Step 2:** `npx tsc --noEmit`; `npm run lint`. Expected: no new errors.
- [ ] **Step 3:** Manual check with the Measurement Protocol validation endpoint is optional; otherwise verify in GA Realtime after deploy (Task 10).
- [ ] **Step 4:** Commit `feat(analytics): send sign_up, login, application and posting events server-side`.

### Task 5: Report shaping and Data API queries

**Files:**
- Create: `lib/analytics/reports.ts`
- Modify: `tests/analytics.test.ts`

**Interfaces:**
- Consumes: Task 1 `RangeKey`, `rangeToGaDates`.
- Produces: `type GaClient = Pick<BetaAnalyticsDataClient, "runReport" | "runRealtimeReport">`; `interface FunnelReport { steps: { key: "visit" | "sign_up" | "view_internship" | "applied"; label: string; users: number }[]; applyClickUsers: number; applicationSubmittedUsers: number }`; `interface OverviewReport { kpis: { activeUsers: number; sessions: number; newUsers: number; pageviews: number }; daily: { date: string; users: number; sessions: number }[]; sources: { channel: string; users: number }[]; topPages: { path: string; views: number }[]; devices: { device: string; users: number }[]; countries: { country: string; users: number }[]; topInternships: { internshipId: string; views: number }[] | null; funnel: FunnelReport }`; `computeFunnel(i: { visitUsers: number; eventUsers: Record<string, number>; appliedUnionUsers: number }): FunnelReport`; `fetchOverviewReport(client: GaClient, propertyId: string, range: RangeKey): Promise<OverviewReport>`; `fetchRealtime(client: GaClient, propertyId: string): Promise<{ activeUsers: number }>`.

Data API calls (`properties/${propertyId}`):

| Section | Dimensions | Metrics | Notes |
|---|---|---|---|
| kpis | none | `activeUsers`, `sessions`, `newUsers`, `screenPageViews` | |
| daily | `date` | `activeUsers`, `sessions` | order by date asc; `YYYYMMDD` → `YYYY-MM-DD` |
| sources | `sessionDefaultChannelGroup` | `activeUsers` | top 10 desc |
| topPages | `pagePath` | `screenPageViews` | top 10 desc |
| devices / countries | `deviceCategory` / `country` | `activeUsers` | top 10 desc |
| topInternships | `customEvent:internship_id` | `eventCount` | filter `eventName = view_internship`; any error → `null` (dimension not registered yet) |
| funnel events | `eventName` | `totalUsers` | filter `eventName IN (sign_up, view_internship, apply_click, application_submitted)` |
| funnel applied | none | `totalUsers` | filter `eventName IN (apply_click, application_submitted)`: this is the union, so nobody is counted twice |
| visit | none | `totalUsers` | |

- [ ] **Step 1: Write failing tests:**
  - `computeFunnel({ visitUsers: 100, eventUsers: { sign_up: 20, view_internship: 50, apply_click: 8, application_submitted: 4 }, appliedUnionUsers: 10 })`: step users `[100, 20, 50, 10]`, `applyClickUsers 8`, `applicationSubmittedUsers 4`; missing event keys count as 0.
  - Fake client whose `runReport` always resolves `[{}]` (no `rows`): `fetchOverviewReport` returns all KPIs `0`, empty lists, funnel users all `0`, not a throw.
  - Fake client where only the `customEvent:internship_id` request rejects: `topInternships === null`, everything else populated.
  - Fake `runReport` returning a `date` row `"20261019"` → `daily[0].date === "2026-10-19"`.
  - `fetchRealtime` with no rows → `{ activeUsers: 0 }`.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Run the independent requests with `Promise.all`; numbers parsed with `Number`, defaulting to 0.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(analytics): GA Data API reports and funnel`.

### Task 6: Cache and service

**Files:**
- Create: `lib/analytics/cache.ts`, `lib/analytics/redis.ts`, `lib/analytics/service.ts`
- Modify: `tests/analytics.test.ts`

**Interfaces:**
- Consumes: Tasks 1 and 5.
- Produces (`cache.ts`): `interface CacheStore { get(key: string): Promise<unknown | null>; set(key: string, value: unknown, ttlSeconds: number): Promise<void> }`; `interface Cached<T> { data: T; stale: boolean; fetchedAt: string }`; `cachedReport<T>(o: { key: string; ttlSeconds: number; staleTtlSeconds?: number; fetcher: () => Promise<T>; store: CacheStore | null }): Promise<Cached<T>>`.
- Produces (`redis.ts`): `redisStore(env?: Record<string, string | undefined>): CacheStore | null` (null when either Upstash var is unset).
- Produces (`service.ts`): `type AnalyticsResult = { configured: false; missing: string[] } | { configured: true; view: "overview" | "realtime"; range: RangeKey; report: OverviewReport | { activeUsers: number }; stale: boolean; fetchedAt: string }`; `getAnalytics(o: { view: "overview" | "realtime"; range: RangeKey; env: Record<string, string | undefined>; store: CacheStore | null; createClient?: (sa: { client_email: string; private_key: string }) => GaClient }): Promise<AnalyticsResult>`.

- [ ] **Step 1: Write failing tests** with an in-memory fake `CacheStore`:
  - Hit: store holds the key → fetcher not called, `stale:false`.
  - Miss: fetcher called once; result written to `key` (ttl 300) and `key:last` (ttl 86400).
  - Store `get` throws → falls through to fetcher and still returns data; store `set` throws → still returns data.
  - `store: null` → fetcher result returned.
  - Fetcher throws with a `key:last` copy → `stale:true` with the old data; no copy → rejects.
  - Two concurrent calls on a cold key → fetcher called once.
  - `getAnalytics` with `{}` env → `{ configured:false, missing:["GA_PROPERTY_ID","GA_SERVICE_ACCOUNT_B64"] }`; with a malformed `GA_SERVICE_ACCOUNT_B64` → `configured:false` and `missing` containing `"GA_SERVICE_ACCOUNT_B64"`; with a valid env, fake `createClient` and `store:null` → `configured:true`.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Single-flight is a module-level `Map<string, Promise>` deleted on settle. `getAnalytics` keys: `ga:overview:{range}` (300 s) and `ga:realtime:now` (60 s).
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(analytics): cached analytics service`.

### Task 7: Moderator API route

**Files:**
- Create: `app/api/moderator/analytics/route.ts`

**Interfaces:** Consumes `getModSession`, `getAnalytics`, `redisStore`, `parseRange`. Produces `GET /api/moderator/analytics?view=overview|realtime&range=today|7d|30d|90d` (defaults `overview`, `7d`).

- [ ] **Step 1:** Implement the gate exactly as in the usage route. Invalid `view` or `range` → `400 { success:false, error }`. Success → `{ success:true, data: AnalyticsResult }` (also when `configured:false`, so the UI shows a card, not an error). A thrown Google error with no stale copy → `502 { success:false, error:"Analytics unavailable" }`, logged with `console.error("[moderator/analytics]", e)`.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3:** Manual: `npm run dev`; `curl -i localhost:3000/api/moderator/analytics` without a cookie → 403. Logged in as a moderator, `?range=7d` returns data (or `configured:false` naming missing vars); `?range=1y` → 400.
- [ ] **Step 4:** Commit `feat(analytics): moderator analytics API`.

### Task 8: Dashboard tab

**Files:**
- Create: `app/moderator/[username]/analytics/page.tsx` (mirror the `usage` page), `components/moderator/AnalyticsPanel.tsx`
- Modify: `components/moderator/ModeratorShell.tsx` (add `analytics` to `NAV` with `BarChart3`, to the `activeTab` union, and to `TAB_TITLES`: "Analytics"; place it after Usage)

**Interfaces:** Consumes `GET /api/moderator/analytics` and the shapes from Tasks 5-6 (import types only). Reuses `Card`, `Stat`, `GroupedBars`, `HBars`, `StackBar`, `COLORS` from `components/moderator/charts.tsx`.

- [ ] **Step 1:** `AnalyticsPanel` (`"use client"`): range buttons (Today / 7d / 30d / 90d, default 7d); fetch on range change; realtime widget polling `view=realtime` every 60 s while the tab is visible. Layout top to bottom: realtime + KPI `Stat` row; funnel (`HBars` with step users, a line beneath with the separate `apply_click` and `application_submitted` user counts); traffic sources; users over time (`GroupedBars`, one series; a line chart is not added); top pages; devices and countries; top internships.
- [ ] **Step 2:** States: loading; `configured:false` → card "Analytics not configured" listing the `missing` names; `stale:true` → note "Data may be stale (last updated {fetchedAt})"; `topInternships === null` → hide that card with a hint to register the `internship_id` custom dimension; all-zero data → hint "GA data can take 24-48h to appear"; request failure → `toast.error("Failed to load analytics")` as `UsagePanel` does.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 4:** Manual with `npm run dev`: tab appears in the nav; switch ranges; with a temporarily blanked `GA_PROPERTY_ID`, the "not configured" card shows and nothing leaks a value.
- [ ] **Step 5:** Commit `feat(analytics): moderator Analytics tab`.

### Task 9: Client event wiring

**Files (modify):** `components/internships/InternshipDetail.tsx` (both `InternshipDetailModal` and `MobileInternshipDetail`; save handlers at ~lines 46 and 187), `components/internships/InternshipCard.tsx` (save, ~line 55), `components/internships/ApplyButton.tsx`, `components/dashboard/BrowseTab.tsx`, `components/dashboard/ResumeTab.tsx` (~line 204)

**Interfaces:** Consumes Task 2 `track`.

- [ ] **Step 1:** Add calls:
  - `view_internship` `{ internship_id: getInternshipId(internship) }` in an effect when the detail modal / mobile detail mounts for an internship.
  - `save_internship` `{ internship_id }` after a successful **save** response only (not un-save), at all three sites.
  - `apply_click` `{ internship_id }` in `ApplyButton.click`, for scraped listings only (`!onPlatform`), just before `void submit()`. iFind-native listings fire nothing here (the server sends `application_submitted`).
  - `search` `{ result_count }` in `BrowseTab`, debounced 800 ms after `query` changes and only when `query` is non-empty. The search text is never sent.
  - `resume_uploaded` (no params) after `/api/user/resume/commit` returns OK.
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3:** Manual (production build, banner accepted): each action produces a request to `google-analytics.com/g/collect` with `en=` the event name; with Decline, none do.
- [ ] **Step 4:** Commit `feat(analytics): client events`.

### Task 10: Docs and final verification

**Files:** Create `docs/ANALYTICS.md`.

- [ ] **Step 1:** Write `docs/ANALYTICS.md`: the env var table from the spec; the manual GA steps (register custom dimensions `user_type` and `internship_id`, event scope; set data retention to 14 months; add the service account email as Viewer); that `NEXT_PUBLIC_GA_ID` belongs in Vercel Production only and needs a redeploy; the `env-manager` overwrite caveat; the attribution limitation noted above.
- [ ] **Step 2:** Run `npm run test:analytics`, `npm run test:usage`, `npm run test:events`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: all pass, build succeeds.
- [ ] **Step 3:** With the real keys: a small script or the dashboard itself confirms the service account can read the property; after deploying, one accepted page view shows in GA Realtime.
- [ ] **Step 4:** Commit `docs(analytics): setup and operations notes`. Do not push.
