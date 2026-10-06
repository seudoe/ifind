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

## Next
- Stage 9: hardening and QA.
