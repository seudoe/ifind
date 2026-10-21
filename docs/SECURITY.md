# Security notes

Living document for secrets handling, deployment configuration and open risks. Updated per hardening pass.

## Secrets

- All secrets are **server-only** environment variables (see `.env.example`). The only `NEXT_PUBLIC_*`
  variables are `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`; both are public URLs.
- `.env*` is git-ignored (`.env.example` is the one exception). No `.env` file is tracked.
- Signing keys are read through `lib/secrets.ts#requireSecret`, which **throws if the variable is missing**.
  Before this pass `lib/auth.ts` fell back to a hardcoded string when `JWT_SECRET` was unset.
- Source maps for browser bundles are disabled (`productionBrowserSourceMaps: false`) and the
  `X-Powered-By` header is removed.
- `lib/logger.ts` redacts Mongo URIs, common API-key prefixes and bearer tokens before printing.

### History scan (this pass)

All 133 commits reachable in the repository were searched for Mongo connection strings with passwords,
`sk-`/`gsk_`/`AIza`/`ghp_`/`github_pat_` keys and `*_SECRET=` / `PRIVATE_KEY=` assignments. **No matches.**
History was not rewritten.

### Credential rotation — action required by an owner

| Credential | Why | Effect of rotating |
|---|---|---|
| `JWT_SECRET` | The old fallback string is public in git history. If any deployment ever ran without `JWT_SECRET`, tokens for that deployment could be forged by anyone. Confirm every Vercel project sets it; rotate if any did not. | Signs out all students. |
| `MOD_JWT_SECRET`, `EMP_JWT_SECRET` | Hygiene; they were already mandatory. Rotate only if exposed. | Signs out moderators / employers. |
| Everything in the local `.env` | `scripts/push-repo-secrets.mjs` copies `.env.local` into the GitHub Actions secret `ENV_LOCAL`, and `.env` has held real keys on developer machines. Rotate anything that was ever pasted into chat, tickets or screenshots. | Update Vercel + `ENV_LOCAL`, then redeploy. |

Rotation must be done by the credential owner; this repository change does not rotate anything.

## Deployment (Vercel)

- Set variables per environment in Vercel (Production / Preview separately); do not reuse production
  database users for previews.
- Vercel serves HTTPS only and redirects HTTP to HTTPS. HSTS is added by the app (see headers).
- API routes are same-origin; there is no CORS allowlist and none should be added unless a separate
  origin genuinely needs browser access.
- MongoDB Atlas: use a dedicated database user with `readWrite` on the `ifind` database only, require
  TLS (default for `mongodb+srv`), and restrict network access to Vercel's egress (static IPs / Atlas
  private link) instead of `0.0.0.0/0` where the plan allows.

## Authorization model (audited)

Every `app/api/**/route.ts` was reviewed. Identity always comes from the verified session cookie, never from
the request body, URL or headers.

| Surface | Guard |
|---|---|
| Student APIs (`/api/user`, `/api/chat`, `/api/job-descriptions`, `/api/internship-match`, `/api/internships/[id]`, `/api/career-assistant`, `/api/usage`) | `getSession()`; every query is scoped by `userId` from the session. |
| Employer APIs | `proxy.ts` token check + `requireEmployer()` / `requireCompanyRole()`; non-members get 404 so company ids can't be probed. |
| Moderator APIs | `proxy.ts` + per-route `getModSession()` and `isVerified`. |
| `/api/admin/*` | **Previously unauthenticated** (anyone could trigger an index rebuild / recommendation refresh). Now `requireVerifiedModerator()`. |

Fixed in this pass: unauthenticated admin endpoints; `PUT /api/job-descriptions/[id]` used `$set: body` (a client could
rewrite `userId` and any other field) and now uses an allowlist; `PUT /api/user/profile` accepted arbitrary keys under
`resume.parsedData` and unvalidated types (non-strings caused 500s) and now allowlists sections and validates every
field; client-supplied ids are checked with `isObjectId` before reaching a query.

Existing indexes already cover the ownership lookups (`userId`-leading compound indexes on chat, matches, job
descriptions; unique email/username/linkedinId on users). Remaining database-level controls (least-privilege Atlas
user, TLS, network allowlist) are deployment settings, listed above.
