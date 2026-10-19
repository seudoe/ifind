# iFind Analytics (Google Analytics 4)

Moderators see how the web app is used in the **Analytics** tab of the moderator dashboard (`/moderator/<username>/analytics`). Data is collected by Google Analytics 4 (GA4) and read back through the GA Data API, cached in Upstash Redis. The existing **Usage** tab (AI-credit spend) is unrelated and unchanged. Design: `docs/superpowers/specs/2026-10-19-google-analytics-design.md`. Code: `lib/analytics/`.

## 1. What is and is not collected

Collected: anonymous page views, GA's standard session/device/country/channel data, and nine product events (section 5) tagged with `user_type` (`student` or `employer`) and, for some, `internship_id`.

Never sent to Google: user IDs, emails, usernames, search text, filenames, query strings or hash fragments.

- `/user/<username>/...` paths are rewritten to `/user/:username/...` before they leave the browser (the static `/user/login` and `/user/register` pages are left as they are) (`sanitizePagePath` in `lib/analytics/events.ts`). `page_location` and `page_referrer` are sanitized the same way.
- `/moderator/*` is excluded entirely: no banner, no tag, no events.
- No tag and no server events in development. The tag loads, and server events are sent, only when `NODE_ENV === "production"` AND `NEXT_PUBLIC_GA_ID` is non-empty.
- Consent: a custom Accept/Decline banner. GA loads only after Accept. The choice is stored in `localStorage` under `ifind_analytics_consent` (`granted` / `denied`); a decline is remembered and not re-asked, and Decline also expires any `_ga` / `_ga_<ID>` cookies (on the host and its parent domains), since server events treat the `_ga` cookie as consent. If storage is unavailable, the visitor counts as not accepted.

## 2. Environment variables

Names only here; values live in the remote env store and Vercel.

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_GA_ID` | Browser tag (the `G-...` measurement ID) and server-side events. Inlined at build time. |
| `GA_PROPERTY_ID` | Data API: the numeric property ID the dashboard reads (`properties/<id>`). |
| `GA_SERVICE_ACCOUNT_B64` | Data API auth: the service-account JSON key, base64-encoded. Server only. |
| `GA_API_SECRET` | Measurement Protocol secret for server-side events. Server only. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis cache. Optional: without them the dashboard calls Google directly. |

Dashboard needs `GA_PROPERTY_ID` and `GA_SERVICE_ACCOUNT_B64`. Server events need `NEXT_PUBLIC_GA_ID` and `GA_API_SECRET`. A malformed `GA_SERVICE_ACCOUNT_B64` is reported as missing (name only, value never echoed).

`NEXT_PUBLIC_GA_ID` is inlined into the client bundle at build time. Set it in **Vercel Production only** (not Preview or Development, so previews never report), and **redeploy after changing it**; a changed value has no effect until the next build.

## 3. One-time GA setup (manual)

In the GA Admin for the property:

1. **Custom dimensions** (Admin > Custom definitions > Create custom dimension), scope **Event**: register `user_type` and `internship_id`. GA only exposes custom parameters to the Data API once registered. Until `internship_id` exists the "Top internships" card is hidden (the rest of the tab works). `user_type` is registered so it is available for exploration in GA itself.
2. **Data retention**: Admin > Data collection and modification > Data retention > event data retention: 14 months.
3. **Viewer access**: Admin > Property access management > add the service account's email (`client_email` inside the key JSON) with the **Viewer** role.
4. **Turn OFF Enhanced measurement entirely** (Admin > Data streams > the web stream > Enhanced measurement). This covers page changes based on browser history events, outbound clicks, file downloads, site search, form interactions and video engagement. Those automatic events read raw URLs, link targets and form/search values from the page, and they bypass our sanitizing: a `/user/<username>` URL or a search query string could reach Google unsanitized. Page views are still sent by our own sanitized code.

## 4. env-manager caveat

`env-manager.js` overwrites `.env` wholesale from the remote store. It also drops the `ENV_MANAGER_*` lines it needs itself. Two consequences:

- Add `ENV_MANAGER_PROJECTID` and `ENV_MANAGER_TOKEN` to the remote store too, or they are wiped on each sync and the next sync stops working.
- Local edits to `.env` are not preserved. Add or change analytics variables in the remote store, then sync.

## 5. Events

Each event is sent from exactly one side (never both), so nothing is double counted.

| Event | Transport | Fired from | Params |
|---|---|---|---|
| `sign_up` | server | Student register route, employer register route, LinkedIn OAuth callback when it creates an account (student or employer) | `user_type` |
| `login` | server | Student login, employer login, LinkedIn OAuth callback for an existing account | `user_type` |
| `application_submitted` | server | `POST /api/internships/[id]/apply`, when an iFind-native application is created | `user_type=student` |
| `internship_posted` | server | Employer internship publish route | `user_type=employer` |
| `apply_click` | client | Apply button on a scraped listing, before the redirect to the source site (`ApplyButton`) | `internship_id` |
| `view_internship` | client | Internship detail view (`InternshipDetail`) | `internship_id` |
| `save_internship` | client | Save action, when something is saved (not on un-save) | `internship_id` |
| `search` | client | Browse tab search/filter (debounced) | `result_count` only, no search text |
| `resume_uploaded` | client | Resume upload success (`ResumeTab`) | none, no filename |

Notes:

- A scraped-listing apply is `apply_click` only, never also `application_submitted`. iFind-native applications are `application_submitted` only.
- `internship_posted` fires on the first publish only, not on draft creation and not on later re-publishes.
- Moderator login is not tracked.
- Client events also carry `user_type` when it can be derived from the route (`/employer/*` is employer, `/user/*` is student).

## 6. Attribution limitation (server-side events)

Server events use the Measurement Protocol. They take the `client_id` from the visitor's `_ga` cookie and, when present, the `session_id` from the `_ga_<ID>` cookie, so GA can usually tie them to the visitor's browsing session. Limits to be aware of:

- Events are sent only in production with `NEXT_PUBLIC_GA_ID` set, and only if the request carries the `_ga` cookie, which exists only if the visitor accepted the banner. No cookie, no event. This keeps server tracking consistent with the consent choice, but means a server event is never recorded for visitors who declined (or who have not decided).
- Measurement Protocol events do not get GA's automatic attribution. If the session cookie is missing or in a format we do not recognise, the event arrives without a session and may not be credited to the right traffic source or session; counts of the event are still correct. Treat source breakdowns of server events as approximate.
- Ad blockers and privacy tools can still block the client-side events (and the tag itself), so client-event counts (`view_internship`, `apply_click`, `save_internship`, `search`, `resume_uploaded`) are lower bounds. That is why the high-value events are sent from the server.

## 7. Dashboard behaviour and operations

Access: any verified moderator (same check as the other moderator routes; others get 403). Ranges: Today, 7d, 30d, 90d (7d means today plus the previous six days, and so on). A "active now" widget uses the realtime report.

Caching (`lib/analytics/cache.ts`, `service.ts`):

| Data | Key | TTL |
|---|---|---|
| Overview report | `ga:<GA_PROPERTY_ID>:overview:<range>` (e.g. `ga:123456789:overview:7d`) | 300 s |
| Realtime | `ga:<GA_PROPERTY_ID>:realtime:now` | 60 s |
| Last-good copy of each | same key plus `:last` | 24 h |

Failure behaviour:

- Redis not configured, erroring or slow: the dashboard calls Google directly and still returns the result (no caching). Redis calls do not retry and give up after 1 s.
- Google erroring: the last-good copy is served and the UI shows "Data may be stale". With no last-good copy, that section shows an error.
- Env vars missing: a "not configured" card lists the missing variable names (never values).
- Concurrent requests for the same cold key within one server instance share one Google call.
- A brand-new property shows zeros; the UI hints "GA data can take 24-48h to appear".

Funnel: Visited (all users) > `sign_up` > `view_internship` > Applied. Applied is distinct users with `apply_click` OR `application_submitted` (counted once even if a user did both). The two are also shown separately below the funnel. Each step is a count of users per event, not a strict sequential path.

Quotas: GA4 collection and the Data API both have free-tier limits, and Upstash's free tier is limited too. Caching keeps Data API calls to roughly a handful of requests per range per five minutes, which should sit well inside the limits at this scale. Check the current limits in Google's and Upstash's docs rather than relying on numbers here.

## 8. Troubleshooting and post-deploy checklist

Checklist after deploying to production with all variables set:

1. Open the site in a clean browser profile. The consent banner appears.
2. Click Accept. In GA Admin > Reports > Realtime (or DebugView) the page view appears within a minute.
3. Log in or register as a test student, then open an internship: `login` / `sign_up` and `view_internship` show in Realtime.
4. Open the moderator Analytics tab. It loads (not "not configured") and, after GA has processed data, shows non-zero numbers.
5. In a second clean profile, click Decline and browse. DevTools Network shows no requests to `google-analytics.com` or `googletagmanager.com`, and the choice is not asked again.
6. Visit `/moderator/...`: no banner and no GA requests.

| Symptom | Likely cause |
|---|---|
| No banner and no tag in production | `NEXT_PUBLIC_GA_ID` unset in Vercel Production, or set but not redeployed. |
| Tab says "Analytics not configured" | The card lists which of `GA_PROPERTY_ID` / `GA_SERVICE_ACCOUNT_B64` are missing or malformed. |
| Tab shows an error for every section | Service account not added as Viewer on the property, or wrong `GA_PROPERTY_ID` (it is the numeric property ID, not the `G-...` measurement ID). |
| All zeros | New property (wait 24-48h), or nobody has accepted the banner yet. |
| "Data may be stale" | Google is failing or rate limiting and the last-good copy is being served. Check quota and credentials. |
| Top internships card hidden | `internship_id` custom dimension not registered yet (section 3). |
| Server events never appear | `GA_API_SECRET` or `NEXT_PUBLIC_GA_ID` missing in the server env, not a production build, or the visitor never accepted the banner (no `_ga` cookie). Failures are swallowed by design and never break the request. |
| Odd URLs or search strings in GA | Enhanced measurement is still on (section 3, step 4). |
| Env vars vanish after a sync | See section 4. |

## 9. Testing

```
npm run test:analytics
```

Pure-logic tests (range mapping, report shaping, funnel, env detection, consent gating, URL sanitizing, cache fallback order, Measurement Protocol payloads). Google and Redis are injected or mocked; the tests make no network calls. `npm run test:usage` and `npm run test:events` cover the neighbouring modules.
