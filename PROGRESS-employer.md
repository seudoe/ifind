# Employer side — progress

## Decisions
- Workspace: only `ifind/`. Don't touch internScraper etc. Don't touch `app/user`, `app/moderator`.
- No scam-detector/vectorizer URL: employer posts go to `pending_review` (moderator queue). iFind and internScraper share only the DB.
- Test/seed DB: the `MONGODB_URI` in `.env.local` (user-approved).
- Team page (Stage 4) and moderator queue (Stage 6) are in scope. Same email may exist as student and employer.
- `EMP_JWT_SECRET` must be added to `.env.local` by the user before Stage 2.

## Done
- Stage 0: recon. Old `app/employer/[username]` removed.
- Stage 1: `types/employer.ts`, 5 models, `lib/employer/validation.ts`, `listingFields` exported, `"employer"` moderation source. `tsc` clean.
- Stage 2: employer auth (lib/employerAuth.ts, /api/employer/auth/*), proxy guards, LinkedIn intent+state enforcement (fixes CSRF gap), login/register rewired. Verified via curl; LinkedIn browser flow pending user test.
- Stage 3: EmployerShell (collapse+mobile drawer), CompanySidebar, InternshipTabs, (app) route group + server layouts, companies/profile/settings/notifications pages, profile/account/notifications APIs, lib/employer/access.ts (requireCompanyRole). Verified via curl on :3000.
- Stage 4: company APIs (create/get/patch/delete, members add/role/remove with role matrix + >=1 owner), /api/employer/uploads (ImageKit; one shared route instead of per-company logo route), CompanyForm (multi-step create, single-page edit), overview/settings/team pages, notify() + slug helpers. Verified via curl: 2 companies, recruiter 403/404, owner rules.

## Next
- Stage 5: post and manage internships.
