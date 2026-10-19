# Context: merging `feature/google-analytics` into `main`

For the agent (and human) doing the merge. Read this before touching git. Nothing here contains secrets; env var
values are never in the repo.

## What this branch is

Google Analytics 4 for iFind, with the results shown inside the moderator dashboard:

- A cookie-consent banner. GA loads only after Accept, only in production, and never on `/moderator/*`.
- Nine product events. Four are sent from the server via the GA Measurement Protocol (`sign_up`, `login`,
  `application_submitted`, `internship_posted`), five from the browser (`view_internship`, `save_internship`,
  `apply_click`, `search`, `resume_uploaded`).
- A new **Analytics** tab in the moderator shell, fed by the GA Data API through `GET /api/moderator/analytics`, cached in
  Upstash Redis. Everything uses free tiers.

Authoritative documents, in this order:
1. `docs/superpowers/specs/2026-10-19-google-analytics-design.md`: the approved design (what and why).
2. `docs/superpowers/plans/2026-10-19-google-analytics.md`: the 10-task implementation plan.
3. `docs/ANALYTICS.md`: operations, setup, event table, cache keys, troubleshooting. This is the one to keep reading
   after the merge.

## Branch topology (important)

```
main (529f14d, == origin/main, has not moved)
  └─ feature/events (8c062ac, pushed to origin)   3 commits NOT in main yet:
        d82b59f Store internship locations as an address array
        784c578 Add LLM usage logging, daily credit limits and ban signals
        8c062ac Add a Hackathons & Contests section for students
        └─ feature/google-analytics   1 squashed commit (all analytics work + this file)
```

- This branch was deliberately cut from `feature/events`, not `main` (owner's decision). So **merging it into `main` also
  brings in the three `feature/events` commits above**.
- If `feature/events` is merged to `main` first (by PR or otherwise), merging this branch afterwards is clean and only
  adds the one analytics commit. If this branch goes first, `feature/events` is included and becomes a no-op later.
- Either way ask the owner whether `feature/events` is meant to ship in the same change. Do not silently ship it.
- `git merge-tree --write-tree main feature/google-analytics` reports no conflicts against current `main`
  (checked 2026-10-20). Re-check if `main` has moved.
- Do not force-push, rebase published history, or delete `feature/events`.

### Submodule pointer (parent repo)

The `ifind` repo is a git submodule of the parent `IPD-All` repo. Merging here does not update the parent. The parent's
submodule pointer for `ifind` must be bumped separately, after the merge lands on the `ifind` remote. Nobody has touched
the parent repo's pointer for this work. That bump is the owner's call, and the parent already shows `ifind` as modified.

## What changed (35 files, about 3.4k lines, mostly additive)

New:
- `lib/analytics/`: `events.ts`, `config.ts`, `consent.ts`, `track.ts` (browser-safe); `measurementProtocol.ts`,
  `reports.ts`, `cache.ts`, `redis.ts`, `service.ts` (server-only).
- `components/analytics/` (`AnalyticsProvider.tsx`, `ConsentBanner.tsx`), `components/moderator/AnalyticsPanel.tsx`.
- `app/api/moderator/analytics/route.ts`, `app/moderator/[username]/analytics/page.tsx`.
- `tests/analytics.test.ts` (89 tests), `docs/ANALYTICS.md`, the spec and plan.

Modified:
- `app/layout.tsx` (mounts `<AnalyticsProvider />`), `components/moderator/ModeratorShell.tsx` (Analytics nav entry).
- Server events wired with `after()` in the student and employer register and login routes, the LinkedIn callback, the
  internship apply route (native path only) and the employer publish route (first publish only).
- Client events in `BrowseTab`, `ResumeTab`, `ApplyButton`, `InternshipCard`, `InternshipDetail`.
- `next.config.ts` (`serverExternalPackages: ["@google-analytics/data"]`), `package.json` and `package-lock.json`
  (adds `@google-analytics/data` and `@upstash/redis`; `@next/third-parties` was tried and removed).

## Verification before and after merging

Run from `ifind/`:

```
npm install
npm run test:analytics      # 89 pass
npm run test:usage          # 22 pass
npm run test:events         # 9 pass
npx tsc --noEmit            # 0 errors
npm run lint                # 199 problems (150 errors, 49 warnings): this is the PRE-EXISTING baseline, not new
npm run build               # succeeds; route list includes /moderator/[username]/analytics
```

Lint is noisy on `main` too. The bar is "not above 199" and "files from this branch are clean".

This project runs a modified Next.js 16.3.0. Per `AGENTS.md`, read `node_modules/next/dist/docs/` before changing Next
code.

## Environment (the code is inert and safe until these are set)

With the variables unset, nothing breaks: no tag loads, server events return `false`, and the tab shows an
"Analytics not configured" card listing the missing names. Set these in Vercel. Never commit values.

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | Vercel **Production only** | Build-time inlined: **redeploy** after setting it. Leave empty in Preview and Development |
| `GA_PROPERTY_ID` | Vercel | The numeric property ID, not the `G-…` ID |
| `GA_SERVICE_ACCOUNT_B64` | Vercel | Base64 of the service-account JSON key |
| `GA_API_SECRET` | Vercel | Measurement Protocol API secret |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Vercel | Cache; if Redis is down, the app calls Google directly |

Caveat: `env-manager.js` overwrites `.env` wholesale from the remote store and drops the `ENV_MANAGER_*` lines it needs.
Add `ENV_MANAGER_PROJECTID` and `ENV_MANAGER_TOKEN` to the remote store, or they are wiped on each sync.

## Manual steps nobody has done yet (owner, in the GA UI, after deploying)

Details are in `docs/ANALYTICS.md` section 3.
1. Register custom dimensions `user_type` and `internship_id`, event scope.
2. Turn OFF Enhanced measurement entirely in the web stream. Its outbound-click and file-download events can carry raw
   links such as Drive resume URLs that bypass the URL sanitizing. This cannot be fixed in code.
3. Set data retention to 14 months.
4. Add the service account email as a Viewer on the property. It has already been confirmed to work: the local
   Analytics tab got HTTP 200 from Google using the real keys.
5. After the deploy, accept the banner on the live site and confirm one page view in GA Realtime, then confirm that
   Decline sends nothing to google-analytics.com.

## What has and has not been tested

Done:
- Unit tests (89), `tsc`, lint baseline, production build.
- A local production build driven by headless Chrome with Google traffic intercepted (25/25 checks): banner for new
  visitors, no Google requests before a choice or after Decline, `_ga` cookies cleared on Decline, sanitized page views,
  `/user/login` and `/user/register` reported as themselves, GA disabled on `/moderator/*`, anonymous requests to the
  analytics route and page rejected.
- A moderator login run of the Analytics tab: the API returned 200 with `configured: true` against the real property,
  all four range buttons fetch, the funnel, "Active now" and zero-data hint render, no key material in responses, and the
  mobile bottom nav with seven items fits.

Not done:
- A real page view or server event reaching Google (it would have hit the production property). Needs a deploy.
- Charts with real data. The property has no traffic yet.
- Forcing Google or Redis to fail in the browser, so the stale note and error card are covered by unit tests only.
- A live Data API call on Vercel. `serverExternalPackages` was added because `google-gax` has a history of bundling
  problems, but it is unproven there. Check the Analytics tab on a preview or production deploy first.

## Design decisions to keep (do not "fix" these in the merge)

1. Own gtag loader with `send_page_view: false`, not `@next/third-parties`. The stock component sent raw
   `/user/<username>` URLs. Page views and `page_location` are sanitized by `sanitizePagePath` and `sanitizeUrl`; reserved
   routes `/user/login` and `/user/register` are left as themselves.
2. Server events need the visitor's `_ga` cookie (which exists only if they accepted) and `NODE_ENV=production`. They are
   sent from `after()` so GA latency never delays a login or apply response.
3. `internship_posted` fires on first publish, not on draft creation (Ruling 8: counting drafts overstates postings).
4. A scraped listing's apply click is `apply_click` only; a native apply is `application_submitted` only. Each event comes
   from exactly one side.
5. `view_internship` is gated by `matchMedia("(min-width: 1024px)")` because the mobile detail and the modal are both
   mounted. This avoids counting every view twice.
6. The funnel is per-event distinct-user counts, not a sequential path. "Applied" is users with `apply_click` or
   `application_submitted`.
7. Cache keys are `ga:<propertyId>:overview:<range>` (300 s) and `ga:<propertyId>:realtime:now` (60 s), with a 24 h
   last-good copy at `<key>:last` for stale fallback. Upstash is called with `retry: { retries: 0 }` and a 1 s timeout per
   operation so a slow Redis cannot stall the dashboard.
8. Decline clears the GA cookies, but only for visitors who click Decline from now on.

## Known minor items left alone

- If one report fails, the whole overview shows an error and "Active now" disappears with it.
- The first page view after leaving `/moderator/*` is dropped.
- Top pages lists each company's `/employer/company/<id>` path separately.
- "Users over time" is bars, because `charts.tsx` has no line chart.
- The stale banner uses fixed amber colours, which may look off in dark mode.
- The realtime poll still runs when GA isn't configured and returns `configured:false` each minute.
- The stale note ignores the realtime result's own `stale` flag.
- The breakpoint pairing (CSS `lg:` wrappers and the `matchMedia` string) is duplicated in `InternshipDetail.tsx`.
- A moderator who is not `isVerified` can load the Analytics page shell (it mirrors the Usage page) but the API still
  returns 403.

## Do not

- Push or merge anything automatically without the owner. Nothing from this branch has been pushed.
- Put the service-account key, the API secret or the Redis token in the repo, logs or client code.
- Add `NEXT_PUBLIC_` to any analytics variable except `NEXT_PUBLIC_GA_ID`.
- Re-add `@next/third-parties`.
- Commit `.env`. It is git-ignored and holds real keys.
