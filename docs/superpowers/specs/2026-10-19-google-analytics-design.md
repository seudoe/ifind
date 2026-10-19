# Google Analytics in the moderator dashboard: design

Status: approved by the project owner in conversation on 2026-10-19. Written before any code.

## Intent

Moderators want to see how the iFind web app is used (where visitors and signups come from,
what they engage with, where they drop off) without leaving the moderator dashboard. We add
Google Analytics 4 (free) to collect the data and a native **Analytics** tab that reads it
back through the Google Analytics Data API.

The existing **Usage** tab covers AI-credit spend per user. It stays as is. Analytics answers
a different question: traffic and behaviour.

The three questions the tab must answer:

1. **Acquisition**: where do visitors and signups come from?
2. **Engagement**: top pages, which internships get viewed, how people save and apply.
3. **Funnel**: visit → sign up → view internship → applied (a scraped-listing apply click or an
   iFind-native submission), and where it leaks.

## Goals

- GA4 tag on all public, student and employer pages, loaded only after cookie consent.
- Custom events for the product actions listed below, with a `user_type` tag.
- An "Analytics" moderator tab (all verified moderators) with the sections listed below.
- Stay inside GA4 and Data API free quotas; cache reads in Upstash Redis.
- Server-side events for the actions that matter most, so ad blockers don't undercount them.

## Non-goals

- Tracking the Telegram bot or `internScraper`. Web app only.
- Per-user analytics or any user identifier sent to Google (no user ID, no email, no username).
- A free-form date picker. Fixed presets only.
- GA's funnel-exploration API (alpha). The funnel is computed from per-event user counts.
- BigQuery export, A/B testing, ads integration.
- Replacing or changing the Usage tab.

## Anti-goals (a failure even if it technically works)

- Any personal data sent to Google.
- GA hits from local dev, from `/moderator/*`, or from visitors who declined consent
  (including server-side events for those visitors).
- The service-account key, API secret or Redis token reaching the browser.
- The dashboard failing outright because Redis or Google is down.

## Decisions (made by the project owner)

| Topic | Decision |
|---|---|
| Dashboard form | Native tab in the existing moderator shell, charts from `components/moderator/charts.tsx`. Not Looker Studio, not a link-out. |
| Access | All moderators who pass `getModSession()` with `isVerified`. No role split. |
| Pages tracked | Everything except `/moderator/*`. |
| Consent | Custom accept/decline banner. GA loads only after Accept. Choice stored in `localStorage`. A decline is remembered and not re-asked. |
| Identity | Anonymous. No user IDs. Only a `user_type` parameter (`student` or `employer`). |
| Events | All nine: `sign_up`, `login`, `view_internship`, `apply_click`, `application_submitted`, `save_internship`, `search`, `resume_uploaded`, `internship_posted`. |
| Event transport | Server-side (Measurement Protocol) for the important ones; client-side (`sendGAEvent`) for the rest. See below. |
| Data freshness | Fixed presets Today / 7d / 30d / 90d, cached ~5 min; one realtime "active now" widget. |
| Cache | Upstash Redis (`@upstash/redis`, free tier). Hosting is Vercel. |
| Redis down | Fall back to calling Google directly. |
| Dev traffic | Tag loads only when `NODE_ENV === "production"` **and** `NEXT_PUBLIC_GA_ID` is non-empty. |
| Funnel's final step | Users with `apply_click` or `application_submitted`. |
| Git | Branch `feature/google-analytics` in the `ifind` repo, branched from `feature/events` HEAD (owner's decision, not `main`). Commit, do not push, do not touch the parent repo's submodule pointer. |

## Event design

| Event | Transport | Fires from | Notes |
|---|---|---|---|
| `sign_up` | server | every sign-up path: student and employer register routes, and the LinkedIn OAuth callback when it creates an account (builder's call: found by grepping `app/api/**/auth`) | `user_type` |
| `login` | server | every login path: student, employer, LinkedIn OAuth callback | `user_type`. Moderator login is not tracked. |
| `application_submitted` | server | `app/api/internships/[id]/apply` when an iFind-native application is created | `user_type=student`. |
| `internship_posted` | server | employer internship create route | `user_type=employer` |
| `apply_click` | client | apply button on a scraped listing, before the redirect to the source site | Scraped listings are applied for on the source site, so this is the closest signal. A scraped click is `apply_click` only, never also `application_submitted`. Never double-count one action. |
| `view_internship` | client | internship detail view | parameter: `internship_id` |
| `save_internship` | client | save action | parameter: `internship_id` |
| `search` | client | search/filter submit | parameter: `search_term` only if it can't contain PII; the builder may drop it |
| `resume_uploaded` | client | resume upload success | no filename |

Each event is sent from exactly one side.

**Server-side events and consent.** The server route sends an event only if the request carries
the visitor's `_ga` cookie, which exists only if the visitor accepted the banner. The `client_id` is
taken from that cookie. No cookie means no event. This keeps server-side tracking consistent
with the consent choice.

GA4 only reports custom parameters in the Data API once they are registered as custom
dimensions. `user_type` and `internship_id` must be registered (GA Admin → Custom definitions,
event scope). The owner does this by hand; the plan should include it as a manual step and the
dashboard should degrade gracefully (hide the breakdown) until it exists.

## Collection (browser)

- A client component, mounted in `app/layout.tsx`, renders the consent banner and, once
  accepted, the GA tag (via `@next/third-parties/google` or an equivalent inline `gtag` snippet).
- No tag, no banner logic runs on `/moderator/*`.
- Gate: `process.env.NODE_ENV === "production" && NEXT_PUBLIC_GA_ID`.
- Consent state in `localStorage` (try/catch around every access). If storage is unavailable,
  treat as "not accepted".
- The app is Next 16 with documented breaking changes. `AGENTS.md` requires reading the
  relevant guide in `node_modules/next/dist/docs/` before writing code. Check that
  `@next/third-parties` supports this Next version before depending on it.

## Dashboard

New route `app/moderator/[username]/analytics/page.tsx` mirroring the `usage` page: redirect
to `/moderator/login` without a session, otherwise render inside `ModeratorShell` with a new
`analytics` nav entry. A new `AnalyticsPanel` client component renders the sections.

Sections (funnel and traffic sources near the top):

- KPI row: active users, sessions, new users, pageviews
- Users over time (line)
- Funnel: visit → `sign_up` → `view_internship` → applied, from user counts per event. The
  last step is users with `apply_click` **or** `application_submitted` (owner's decision), so
  scraped and iFind-native applying both count. Also show the two as separate numbers beneath it.
- Traffic sources / default channel grouping
- Top pages
- Device category and country
- Top viewed internships (by `internship_id` custom dimension)
- Realtime "active users now"
- Range selector: Today / 7d / 30d / 90d

New API route `GET /api/moderator/analytics?range=…` gated like the other moderator routes
(`getModSession()` and `isVerified`, else 403). A second route or a query parameter serves
the realtime widget with a shorter cache. Runs on the Node runtime.

Reads use `@google-analytics/data` (`BetaAnalyticsDataClient`) with credentials parsed from
`GA_SERVICE_ACCOUNT_B64` (base64 → JSON → `client_email`, `private_key`). The Data API property
is `properties/${GA_PROPERTY_ID}`.

## Caching and failure behaviour

- Redis keys `ga:{report}:{range}`, TTL 300 s; realtime TTL 60 s.
- A second, long-lived "last good" copy (e.g. 24 h) of each result backs the stale fallback.
- Redis unset or erroring → call Google directly (no cache), and still return the result.
- Google erroring → serve the last-good copy with a `stale: true` flag; the UI shows
  "data may be stale". No last-good copy → an error state in that section only.
- Keys missing → the tab shows a "not configured" card listing the missing env var names
  (names only, never values).
- Zero data on a new property → show zeros with the hint "GA data can take 24-48h to appear".
- Avoid a cache stampede on cold cache (e.g. single-flight per key within one instance).

## Configuration

Already synced into `ifind/.env` and to be set in Vercel (Production only for
`NEXT_PUBLIC_GA_ID`; not Preview/Development):

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_GA_ID` | browser tag (build-time inlined: redeploy after changing) |
| `GA_PROPERTY_ID` | Data API |
| `GA_SERVICE_ACCOUNT_B64` | Data API auth |
| `GA_API_SECRET` | Measurement Protocol (server events) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | cache |

`env-manager.js` overwrites `.env` wholesale from the remote store and drops the
`ENV_MANAGER_*` lines it needs; do not rely on it to preserve local edits.

## Testing

- Existing tests use `tsx --test` (`test:usage`, `test:events`). Add a `test:analytics` script
  in the same style.
- Unit-test the pure parts: range → date-range mapping, response → chart-data shaping,
  funnel computation, env-var detection for the "not configured" state, consent gating logic,
  cache fallback order (Redis hit / miss / error, Google error → stale).
- The Google and Redis clients are injected or mocked; tests must not hit the network.
- Manual verification after the keys exist: the service account can read the property; a real
  page view appears in GA Realtime after accepting the banner on the deployed site.

## Left to the builder

- Exact file and component names, chart choices per section within `charts.tsx`, banner copy and styling.
- Whether `@next/third-parties` or a hand-written `gtag` snippet is used.
- Exact Data API dimensions/metrics per section.
- Whether to add a `lib/analytics/` module layout mirroring `lib/usage/`.
- Single-flight mechanism and last-good TTL.

## Out of scope for now / possible later

Free date picker, per-moderator analytics views, alerts, BigQuery export, tracking the Telegram bot.
