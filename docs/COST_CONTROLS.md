# Cost and resource controls

What stops a script from running up the AI bill or loading the backend. All limits live in `lib/rateLimit.ts` (`RULES`),
`lib/usage/config.ts` (credits and the daily budget) and are stored in MongoDB, so they hold across serverless instances.

## Layers on a billed AI route (`lib/usage/withBilling.ts`)

1. Signed-in, not banned (`getSession`).
2. 12 billed requests per user per minute.
3. 600 billed requests per network address per hour (generous: a campus shares one address).
4. **Site-wide daily budget** (`systemDailyBudgetUsd`, default 3, set in the moderator Usage panel). Once today's estimated spend reaches it, billed routes answer 503 until 12:00 AM IST. `0` turns the cap off. A database error returns 500 instead of spending (fail closed).
5. Per-user daily credit pool (default 40), reserved in one atomic update before the model is called.
6. Credits are refunded only when no provider call succeeded.

Every provider call is recorded with its token counts and estimated cost; the totals feed the per-user and site-wide rows.

## Other cost-bearing paths

| Path | Limit |
|---|---|
| Paid resume extractor (GPT-4o / Gemini) | 3 per month per LinkedIn-verified user, taken atomically before the call; falls back to the free extractor when the site budget is spent |
| Resume uploads | 30 per hour per user, 5 MB, PDF bytes checked |
| Profile saves (trigger the vectoriser) | 60 per hour per user |
| Chat sessions | 30 created per hour, 200 held per user |
| Employer create / duplicate internship | 120 writes per hour per employer |
| Employer publish (calls the scam/moderation pipeline) | 20 per hour per employer |
| LinkedIn OAuth callback (calls LinkedIn) | 40 per 15 minutes per address |
| Login / register | see `docs/SECURITY.md` |
| Request bodies | 2 MB, 6 MB on the three upload routes (`proxy.ts`) |
| List endpoints | chat sessions 200, job descriptions 200, messages 1000, match list 100, notifications 100 |

There is no email or SMS sending anywhere in this app, so there is no route to spam through.

## Set these outside the code

- **Provider spend caps.** The budget above is an estimate computed from token counts. Also set a hard monthly limit in the Groq, OpenAI and Google AI consoles, so a bug or a missed price change cannot exceed it.
- **Edge rate limiting.** The limiter writes to MongoDB on every request, so a flood still costs database writes even when answered with 429. Add a Vercel Firewall rate-limit rule on `/api/*` (for example 300 requests per minute per IP) so floods are dropped before they reach a function.
- **Alerts.** Atlas alerts on operations per second and connections; a billing alert on each provider.
- **Bot protection.** Accounts are free and unverified, so a script can create many accounts (10 per hour per address). Add email verification or a CAPTCHA before AI features unlock; until then the site-wide budget is the ceiling.
