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

## Authentication & API hardening

- **Passwords:** bcrypt cost 12 (existing). Max 128 chars enforced on every login/register/change route to bound work.
- **Timing/enumeration:** `lib/passwords.ts#checkPassword` always performs a bcrypt compare (against a dummy hash for
  unknown accounts), and student/employer login now return one identical message for unknown account, LinkedIn-only
  account and wrong password. Registration still reports "already registered" (needed to be usable); that endpoint is
  rate-limited.
- **Rate limiting:** `lib/rateLimit.ts`, a fixed-window counter in MongoDB (`RateLimit` model with TTL index), shared across
  serverless instances. Login: 30/15 min per IP and 8/15 min per account (5 for moderators). Register: 10/h per IP.
  Password change and account deletion: 10/h per user. Uploads: 30/h per user. Fails open if the database is
  unreachable (the routes need it anyway).
- **CSRF:** cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production. `proxy.ts` additionally rejects
  state-changing `/api` requests whose `Origin` host differs from the site or whose `Sec-Fetch-Site` is `cross-site`.
- **Sessions:** JWT in an `HttpOnly` cookie (students 30 d, employers 7 d, moderators 24 h). Fresh token per login (no
  fixation). Banned/deleted users are rejected on every request. Tokens are stateless, so a password change does not
  revoke other devices' tokens until they expire; rotate the signing key to force a global sign-out.
- **Redirects:** all server redirects are same-origin fixed paths; no user-controlled redirect target exists.
- **XSS:** React escapes output; `dangerouslySetInnerHTML` is only used for two static `<style>` blocks. Employer rich
  text goes through `lib/employer/sanitize.ts`.
- **Uploads:** size cap + *byte-signature* check (`lib/uploads.ts`): avatars/company images must really be JPEG/PNG/WebP
  (SVG/HTML disguised as images is rejected, extension comes from the detected format); resumes must contain `%PDF-`.
- **API responses:** internal error text is no longer returned (`message: error.message` removed from 14 routes and the
  login 500); dashboard/me projections exclude password hash, login-attempt history and embedding vectors.

### Not done / needs a decision

- **Bot protection (CAPTCHA):** needs a provider and keys (e.g. Cloudflare Turnstile) plus a frontend widget. Rate limits
  are the interim control.
- Resume upload/re-extract routes still surface parser error text to the signed-in user; those messages come from
  upstream AI/extractor failures and should be reviewed before being wrapped.
- Session revocation on password change (needs a token version on the user document).

## HTTP security headers & dependencies

Set in `next.config.ts` for every route (verified on a production build):

| Header | Value / reason |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; scripts `'self' 'unsafe-inline'` (Next's inline bootstrap; a nonce CSP would force every page dynamic); no `unsafe-eval` in production; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; images any `https:` (scraped company logos); `frame-src` = ImageKit origin (resume preview); `upgrade-insecure-requests`. |
| `Strict-Transport-Security` | 2 years, `includeSubDomains`, production only. **No `preload`** — submit to the preload list only after confirming every subdomain is HTTPS. |
| `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` / `Cross-Origin-Opener-Policy` | `nosniff` / `DENY` / `strict-origin-when-cross-origin` / camera, mic, geolocation, payment off / `same-origin`. |
| `Cache-Control: private, no-store` | `/api/*`, `/user/*`, and the signed-in parts of `/employer` and `/moderator`. |

CORS: no `Access-Control-*` headers are sent, so browsers keep the default same-origin policy; do not add a wildcard.
OAuth (LinkedIn) is a top-level redirect and is unaffected; fonts are self-hosted by `next/font`.

Known CSP gap: `script-src 'unsafe-inline'` means the CSP will not stop injected inline scripts. It still blocks
third-party script origins, framing, plugin content and form hijacking. Moving to nonces is a larger change.

### Dependencies

`npm audit --omit=dev` went from **4 vulnerabilities (1 critical, 3 high) to 0**: `next` 16.3.0 → 16.4.2 (patch-line fixes for
RCE/SSRF/cache-poisoning advisories; same major, build verified) and `nanoid`, `sharp`, `source-map-js` via `npm audit fix`.

Remaining (`npm audit`, dev only): `braces` ReDoS reached through `eslint-config-next → fast-glob → micromatch`. It only
runs inside the linter on repo files; the suggested fix downgrades `eslint-config-next` to v14, so it is left until the
Next ESLint plugin updates its glob dependency.
