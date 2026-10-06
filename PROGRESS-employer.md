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
- Stage 5: internship APIs (list+aggregate counts, create/patch/delete, [action]=publish|pause|close|archive|duplicate), publish validation + moderation (no SCAM_DETECTOR_URL => pending_review; unverified never auto-approved), material edit resets moderation, lazy auto-close + notification, InternshipForm (autosave drafts, screening builder), internships table, overview/details/settings tabs. students-applied and company applicants are empty-state stubs until Stage 7. Env: optional SCAM_DETECTOR_URL.
- Stage 6: moderator queue for employer posts: source switch in InternshipsPanel, ?source=employer on GET /api/moderator/internships (drafts excluded), body.source="employer" on PATCH /[id] (manually_approved/rejected, NO vectorizer, notifies all company members). Verified via curl.
- Stage 7: lib/employer/applications.ts (createApplication = the apply seam, listApplicants, changeStatus w/ transition map, skill-overlap matchScore), applications APIs (company-wide + per-internship list, detail, PATCH status/rating, notes, bulk-status), ApplicantsTable + ApplicantDrawer, overview funnel + 14-day chart, scripts/seed-applications.ts (--clean to undo). Verified via curl incl. cross-company ids.
- Notifications now live in 3 collections (notifications.student|employer|moderator); models/Notification.ts exports notificationModel(type); notify() routes by recipientType. Old `notifications` collection migrated (1 doc) and dropped.
- Stage 8: verified each trigger (member added, moderation approve/reject, new application, auto-close) yields exactly one notification per relevant member, incl. 15 concurrent reads of an expired internship; mark one/all read scoped to the recipient.
- Stage 9: hardening done (see below). User will run the manual QA checklist later; findings to be fixed as they come.
- Stage 10: docs/EMPLOYER.md written (data model, routes, roles, state machines, moderation, env vars, student-side seams). Added lib/employer/visibility.ts (visibleToStudentsFilter), the shared student-visibility helper required by the spec.
- Pipeline integration: employer posts now go through internScraper `POST /process` (stateless verdict), approved posts are vectorized in place in `internships.this-platform` via the vectorizer's new `POST /vectorize-platform`; `source` is an enum everywhere (scraper id or `ifind`). Replaces the optional SCAM_DETECTOR_URL. See internScraper/pipeline-diagram.md.

## Next
- Fix anything the manual QA turns up (checklist at the bottom of this file). Optional: run Model.syncIndexes() (needs user OK). Student-side phase: see docs/EMPLOYER.md section 11.

## Stage 9 - authz audit
Every `/api/employer/**` route except `auth/*` calls `requireCompanyRole(companyId, minRole)` or `requireEmployer()` (lib/employer/access.ts). Child ids (internship, application) are always queried together with the company id, so another company's id is "not found". `proxy.ts` also 401s any non-auth employer API call without a valid cookie.

Run against the dev server (script not committed). Outsider = employer of another company. "other-co ids" = outsider calls their OWN company id with company X's internship/application ids. bulk-status returns 200 by design (per-item result); verified it reports "not found" and changes nothing. Result: **0 failures**.

| route | min role | anon | outsider | other-co ids | lower role |
|---|---|---|---|---|---|
| GET …/{C} | recruiter | 401 | 404 | - | - |
| PATCH …/{C} | admin | 401 | 404 | - | 403 |
| DELETE …/{C} | owner | 401 | 404 | - | 403 |
| GET …/{C}/members | recruiter | 401 | 404 | - | - |
| POST …/{C}/members | admin | 401 | 404 | - | 403 |
| PATCH …/{C}/members | admin | 401 | 404 | - | 403 |
| DELETE …/{C}/members | admin | 401 | 404 | - | 403 |
| GET …/{C}/internships | recruiter | 401 | 404 | - | - |
| POST …/{C}/internships | recruiter | 401 | 404 | - | - |
| GET …/{C}/internships/{I} | recruiter | 401 | 404 | 404 | - |
| PATCH …/{C}/internships/{I} | recruiter | 401 | 404 | 404 | - |
| DELETE …/{C}/internships/{D} | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/internships/{I}/pause | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/internships/{I}/close | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/internships/{I}/archive | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/internships/{I}/publish | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/internships/{I}/duplicate | recruiter | 401 | 404 | 404 | - |
| GET …/{C}/internships/{I}/applications | recruiter | 401 | 404 | 404 | - |
| GET …/{C}/applications | recruiter | 401 | 404 | - | - |
| GET …/{C}/applications | recruiter | 401 | 404 | 404 | - |
| GET …/{C}/applications/{A} | recruiter | 401 | 404 | 404 | - |
| PATCH …/{C}/applications/{A} | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/applications/{A}/notes | recruiter | 401 | 404 | 404 | - |
| POST …/{C}/applications/bulk-status | recruiter | 401 | 404 | 200 | - |
| GET …/companies | any employer | 401 | - | - | - |
| POST …/companies | any employer | 401 | - | - | - |
| GET …/profile | any employer | 401 | - | - | - |
| PATCH …/profile | any employer | 401 | - | - | - |
| DELETE …/account | any employer | 401 | - | - | - |
| POST …/account/password | any employer | 401 | - | - | - |
| DELETE …/account/linkedin | any employer | 401 | - | - | - |
| GET …/notifications | any employer | 401 | - | - | - |
| PATCH …/notifications | any employer | 401 | - | - | - |
| POST …/uploads | any employer | 401 | - | - | - |


## state behaviours
- archived: PATCH ->: 409
- archived: publish ->: 409
- archived: applicants GET ->: 200
- archived: page ->: 200
- HTML in title stored as ->: "alert(1)Safe Title"
- HTML in note stored as ->: "hello"
- 300KB body ->: 413
- javascript: website ->: 400 website: Must be an http(s) URL
- 201-char tagline ->: 400
- 11 screening questions ->: 400
- 129-char password register ->: 400
- banned recruiter: API ->: 401
- banned recruiter: notifications ->: 401
- banned recruiter: page ->: 307 /employer/login
- banned recruiter: login ->: 403
- company with only draft/closed: DELETE ->: 200
- deleted company: member API ->: 404
- deleted company: page ->: 404
- deleted company: absent from list ->: true
- owner (no companies left) DELETE account ->: 409 Transfer ownership or delete these companies first: ZZ AZ
- deleted employer: API after ->: 200
- deleted employer: login ->: 200


Notes:
- The last two lines of the state block are expected: the account delete was refused (owner of company ZZ AZ), so login still worked. Account deletion itself was verified in Stage 3.
- Recruiter DELETE on members is allowed only for leaving (self); removing others needs admin+.

## Stage 9 - input hardening
- Plain text only: lib/employer/sanitize.ts strips HTML tags and control chars from company, internship, profile, note, status-note and register input (stripHtml/plainText). React escapes on render too.
- URLs must be http(s) (zod); company logo/cover must be ImageKit URLs.
- Limits: zod string/array/number limits (lib/employer/validation.ts), 10 screening questions, 100 notes per applicant, 200 bulk ids, 10 companies per employer, password <= 128 chars, email <= 254, JSON body <= 256KB on guarded employer APIs (proxy.ts, 413), uploads <= 2MB.
- Search/sort/status query params are whitelisted or regex-escaped; ids validated with isValidObjectId; unknown body keys are dropped by zod (no mass-assignment of members/verification/slug).
- Known gaps (not done): no login rate limiting; no email verification for password signups; auth routes are not size-capped by the proxy (bodies are tiny, hosting limits apply).

## Stage 9 - indexes
Models declare indexes (Company, PlatformInternship, Application, Notification x3, Employer). Mongoose does not create them unless autoIndex runs; `Model.syncIndexes()` is a MANUAL step and needs the user's OK. Not run.

## Stage 9 - tsc / lint
`npx tsc --noEmit`: clean. ESLint: 0 errors in the employer/notification/moderator-panel files I touched, except pre-existing ones in components/moderator/ModerationRejectModal.tsx (set-state-in-effect) and ModeratorRow.tsx (no-explicit-any), which I did not change. One pre-existing warning in app/employer/register/page.tsx (react-hook-form watch()). The wider repo has ~170 pre-existing lint errors outside this work.

## Manual QA checklist (run on localhost, then report results)
1. Employer email signup -> lands on /employer/companies (empty state). Logout, login again.
2. LinkedIn employer login + student LinkedIn login (already confirmed once).
3. Register company: step through 5 steps, upload a logo, Register. Card appears with Unverified badge + Owner.
4. Register a second company; switch via the company switcher.
5. Sidebar: global sidebar collapses to icons inside a company, expands on hover; company sidebar stays fixed while scrolling; mobile (<768px) drawers open/close.
6. Team: add a second employer account by email as recruiter. Log in as them: Team/Settings tabs hidden, /settings URL 404.
7. Post New Internship: heading + error stay fixed; publish an incomplete form -> error shows at top; fill and publish; status Published + "In review".
8. Autosave: type a title, wait, open the Internships list -> the draft is there.
9. Moderator panel: Employer-posted switch -> approve; employer sees Approved + notification bell.
10. Edit a published internship title -> goes back to In review; edit city only -> stays approved.
11. Pause / resume / close / archive / duplicate / delete draft from the internship Settings tab.
12. Seed applicants: npx tsx scripts/seed-applications.ts <internshipId> 8. Open Students applied: filter, search, sort, drawer, move through the pipeline, illegal moves not offered, rate, add note, bulk shortlist.
13. Company Applicants page: internship filter works. Overview tab: funnel + 14-day chart.
14. Deadline: set a past deadline (DB) and reload -> internship auto-closes, one notification per member.
15. Profile + Settings: edit profile, change password, set password on a LinkedIn-only account, link/unlink LinkedIn, delete account (blocked while sole owner).
16. Clean up: npx tsx scripts/seed-applications.ts --clean <internshipId>.
