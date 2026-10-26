# iFind (web app)

Next.js 16 / React 19 / Tailwind 4 / MongoDB app with three portals: students, employers and moderators. It is the user-facing part of iFind; scraping, scam scoring, vectors and resume extraction live in the sibling services (see `../README.md` for the whole system and wiring).

Public site: `https://ifind.internships.workers.dev` (a Cloudflare Worker, `../proxy-ifind`, balancing six Vercel deployments). Local: `http://localhost:3000`.

## Features

- **Students:** profile and resume upload (3-tier extraction: resume-extractor, OpenAI, Gemini), HNSW recommendations, browse and save internships, applications tracker, ATS resume analyzer, AI career assistant (roadmaps, interview prep, STAR, project ideas, resume rewrite), chat, events, notifications.
- **Employers:** companies and team roles, post internships (scam-checked via internScraper `/process`), applicant pipeline with notes and bulk status, notifications.
- **Moderators:** review queue for flagged internships, per-item scam analysis and rescan (`/analyze`), employers, companies, users, events, scrape jobs, usage and analytics, moderator verification and bans.
- Themes and the design language in `docs/` and the repo-root design files; email through Brevo; image uploads through ImageKit; LinkedIn sign-in.

## Commands

```bash
npm install
npm run dev                # http://localhost:3000
npm run build && npm start # production build
npm run lint
npm run scan:secrets       # fails if a secret-looking value is committed
npm run test:security      # validators, auth, secrets, redirects, notifications, email
npm run test:e2e           # security.e2e.test.ts (needs a running server)
npm run test:events | test:usage | test:analytics | test:gemini
npm run env-manager        # pull/push .env via the env-manager service (ENV_MANAGER_URL)
```

Scripts: `scripts/push-repo-secrets.mjs` uploads GitHub Actions secrets (`ENV_LOCAL` from `.env.local` plus `VERCEL*` from `.env.repo`; `--dry` previews; needs `GH_TOKEN`), `scripts/sync-vercel-env.sh`, `scripts/seed-applications.ts`, `scripts/migrate-company-notifications.ts`, `scripts/gen-theme-palette.mjs`.

## Environment (`.env.local`)

| Name | Purpose |
|---|---|
| `MONGODB_URI` | database |
| `JWT_SECRET`, `EMP_JWT_SECRET`, `MOD_JWT_SECRET` | student, employer and moderator session tokens (must be identical on every Vercel deployment) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `TRUSTED_PUBLIC_HOSTS` | public origin(s) and hosts allowed by the same-site check |
| `INTERNSCRAPER_URL`, `INTERNSCRAPER_API_KEY` | internScraper base URL and the `x-api-key` sent to `/process` and `/analyze` |
| `VECTORISER_URL` | vectoriser base URL |
| `RESUME_EXTRACTOR_URL`, `MAX_WAIT_FOR_HF` | resume extractor (via `proxy-resume-extractor`) and its timeout |
| `GROQ_API_KEYS` (also `GROQ_API_KEY`, `GROQ_API_KEY_1..n`) | career assistant, chat, resume analysis. Comma-separated; rotated on rate limit or rejected key |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | resume extraction and assistant fallbacks |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn sign-in |
| `IMAGEKIT_*`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | image uploads |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate limits and usage counters |
| `NEXT_PUBLIC_GA_ID`, `GA_API_SECRET`, `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_B64` | analytics |
| `GOOGLE_DRIVE_FOLDER_ID`, `GH_TOKEN` | resume storage and repo scripts |

## Pages

- Student: `/user/login`, `/user/register`, `/user/[username]/{overview,browse,browse/[slug],saved,applied-internships,internship-match,resume,career,chat,events,notifications,profile,settings}`.
- Employer: `/employer/login`, `/employer/register`, `/employer/(app)/{companies,company/[companyId]/{overview,internships,applicants,post-new-internship,team,settings},notifications,profile,settings}`.
- Moderator: `/moderator/login`, `/moderator/register`, `/moderator/pending`, `/moderator/[username]/{internships,analyze,employers,companies,users,events,scrapes,usage,analytics,moderators,notifications}`.
- Public: `/`, `/internships`, `/internships/[slug]`.

## API (`app/api`)

All routes are JSON over cookie sessions. Mutations also pass the same-site check (the proxy does it at the edge).

| Area | Routes |
|---|---|
| Student auth | `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`, `GET /api/auth/linkedin` and `/callback` |
| Student data | `/api/user/{profile,dashboard,applications,notifications,notification-prefs,vectorization-status,upload-picture,delete-account}`, `/api/user/applications/[internshipId]` and `/withdraw` |
| Resume | `/api/user/resume`, `/upload-temp`, `/analyze`, `/reextract`, `/commit`, `/discard-temp`, `GET`/`HEAD /api/user/resume/file` (streams the student's own PDF inline) |
| Internships | `GET /api/internships/[id]`, `POST /api/internships/[id]/apply`, `/save`, `/api/internship-match[/id]`, `/api/job-descriptions[/id]` |
| Assistant and chat | `/api/career-assistant/{career-roadmap,learning-roadmap,interview,projects,rewrite,star}`, `/api/chat/{sessions,sessions/[id],messages}` |
| Misc | `/api/events`, `/api/usage/me` |
| Employer auth and account | `/api/employer/auth/{register,login,logout,me,linkedin}`, `/api/employer/{account,account/password,account/linkedin,profile,uploads,notifications}` |
| Employer companies | `/api/employer/companies[/companyId]`, `/members`, `/internships[/internshipId][/action]`, `/internships/[id]/applications`, `/applications[/applicationId][/notes]`, `/applications/bulk-status` |
| Moderator auth | `/api/moderator/auth/{register,login,logout,me}` |
| Moderator tools | `/api/moderator/{internships,employers,companies,users,events,moderators,scrapes,usage,analytics,notifications}` (with `[id]` variants, `/moderators/[id]/{ban,verify}`, `/users/[id]/signals`), `/analyze`, `/analyze/[kind]/[id]` and `/rescan` |
| Admin | `/api/admin/rebuild-index` (calls vectoriser `/rebuild-graph`), `/api/admin/refresh-recommendations` (vectoriser `/recommend-all`) |

## Deploy

Push to `main`: `.github/workflows/deploy-vercel.yaml` deploys the canary Vercel account (`seudoe`) first, then the other five, each building with the `ENV_LOCAL` repo secret. After changing `.env.local`, run `scripts/push-repo-secrets.mjs` and re-run the workflow (Actions, Run workflow). Details and the full wiring: `../README.md` sections 5, 6 and 9.

More docs: `docs/SECURITY.md`, `docs/COST_CONTROLS.md`, `docs/STUDENT.md`, `docs/EMPLOYER.md`, `docs/ANALYTICS.md`, `docs/MONGODB_ACCESS.md`, `PROGRESS-*.md`.
