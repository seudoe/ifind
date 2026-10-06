# iFind Employer Side

Employers sign up, register companies, post internships that iFind moderates, and run applicants through a hiring pipeline. Everything lives in `ifind/` (Next.js 16). `internScraper/`, the vectorizer and the student/moderator flows are unchanged except where noted under "Touched outside the employer area".

Resume state and decisions made along the way: `PROGRESS-employer.md`.

## 1. Collections

All models: `models/*.ts`. Enum values are defined once in `types/employer.ts` and imported by the models.

| Collection | Model | Purpose |
|---|---|---|
| `employers` | `Employer` | Employer accounts, separate from students (`users`) and moderators. Same email may exist in several. Unique `email`; unique sparse `linkedinId`. No username. |
| `companies` | `Company` | Company profile, `members[{employerId, role, addedBy, addedAt}]`, `verification {status, ...}`, soft delete via `deleteDetails`. Indexes: `members.employerId`; `verification.status + createdAt`. Slug is unique (name + numeric suffix). |
| `internships.this-platform` | `PlatformInternship` | Employer-posted internships. Reuses the scraped listing shape (`listingFields`, exported from `models/Internship.ts`) so a vectorizer/feed can consume both later. Indexes: `companyId + status + createdAt`; `status + moderation.status + deadlineDate`; non-unique sparse `fingerprint`. |
| `applications` | `Application` | One per student per internship (unique `internshipId + studentId`). Frozen `resumeSnapshot`, `statusHistory`, internal `notes` and `rating` (employer-only). |
| `notifications.employer` / `.student` / `.moderator` | `notificationModel(type)` in `models/Notification.ts` | One collection per audience. Only the employer one is written today. |

`PlatformInternship` sets on every save: `isRemote = workMode === "remote"`, `source = "ifind"`, `moderation.source = "employer"`, `company` (denormalised name), and `fingerprint` using the same formula as `internScraper/pipeline.py:generate_fingerprint` (`platformFingerprint()`). `applyLink` is `null` (applications happen on iFind). `source` is always `"ifind"`; scraped listings use their scraper id (`INTERNSHIP_SOURCES` in `types/internship.ts`). After approval the vectorizer writes `tfidf_vector` / `bert_vector` / `vectorizedAt` onto the document (fields are `select: false`, never sent to clients). Drafts may omit `stipend`, `duration` and `summary`; the publish step requires them.

## 2. Auth

- Cookie `ifind_emp_token`, secret `EMP_JWT_SECRET`, 7 days (`lib/employerAuth.ts`). The route guard is `proxy.ts` (`/employer/*` pages redirect to login, `/api/employer/*` returns 401; `/employer`, `/employer/login`, `/employer/register` and `/api/employer/auth/*` are public).
- Server layouts re-check the account (exists, not banned, not deleted) via `getValidEmployer()` (`lib/employer/access.ts`).
- Email + password: `/api/employer/auth/{register,login,logout,me}`.
- LinkedIn reuses the existing flow (`/api/auth/linkedin`, `/callback`). `?as=employer` signs in/creates an employer; `?as=employer-link` links LinkedIn to the logged-in employer from Settings. The intent travels in the `linkedin_oauth_intent` cookie. The OAuth `state` check is now enforced for students too. An existing employer is matched by email only when LinkedIn reports `email_verified`.

## 3. Roles

`ROLE_RANK`: recruiter 1 < admin 2 < owner 3 (`types/employer.ts`). Enforced by `requireCompanyRole(companyId, minRole)` in every company API (non-members get 404, too-low roles 403).

| Action | owner | admin | recruiter |
|---|---|---|---|
| View company, internships, applicants | yes | yes | yes |
| Create/edit/publish/pause/close/duplicate internships, move applicants, rate, add notes | yes | yes | yes |
| Edit company profile | yes | yes | no |
| Add/remove members (non-owners), change non-owner roles | yes | yes | no |
| Add/remove owners, delete company | yes | no | no |
| Leave the company | yes (not as last owner) | yes | yes |

A company always keeps at least one owner. An account cannot be deleted while it is the sole owner of a company.

## 4. State machines

**Internship `status`** (employer-controlled): `draft -> published <-> paused -> closed -> archived`.
Drafts can be deleted; anything else can only be closed or archived. Closed and archived are read-only (duplicate to reuse). `published` and `paused` can be edited. Auto-close (lazy, no cron, `syncAutoClose` in `lib/employer/internships.ts`): past `deadlineDate` (stored as end of that day) or `maxApplications` reached; notifies all members once.

**Moderation `moderation.status`** (platform-controlled, gates visibility): `pending_review | auto_approved | manually_approved | auto_rejected | manually_rejected`.

**Visible to students** = `status === "published"` and moderation approved (`auto_` or `manually_`) and `isActive` and (no deadline or deadline in the future). One definition: `visibleToStudentsFilter()` in `lib/employer/visibility.ts`.

**Application `status`**: `applied -> under_review | shortlisted | rejected`; `under_review -> shortlisted | rejected`; `shortlisted -> interview | offered | rejected`; `interview -> offered | rejected`; `offered -> hired | rejected`; `rejected -> under_review` (undo); `hired` and `withdrawn` are terminal (`withdrawn` is set only by the student). The single map is `APPLICATION_TRANSITIONS` (`types/employer.ts`), applied by `changeStatus()` (`lib/employer/applications.ts`). Every change appends to `statusHistory` in the same conditional update (a concurrent change returns 409).

## 5. Moderation of employer posts

Employer posts go through the same pipeline as scraped ones (diagram: `internScraper/pipeline-diagram.md`).

1. Publish from `draft` validates completeness (`internshipPublishSchema`), sets `datePublished`, then `runModeration()` (`lib/employer/internships.ts`) calls `POST {INTERNSCRAPER_URL}/process` with `source: "ifind"`. internScraper validates, scam-scores and returns a verdict; it stores nothing. ifind saves the verdict on its own document:
   - `block -> auto_rejected`, `review -> pending_review`, `clear -> auto_approved` only if the company is `verified`, otherwise `pending_review` (flag `unverified_company`). ifind sends `companyVerified` and internScraper applies the rule.
   - `runModeration()` saves the reset (pending, vectors cleared, post already `published`) BEFORE calling `/process`. internScraper then writes the verdict onto the document and, when auto-approved, calls the vectoriser itself; ifind's own save afterwards only writes the same verdict fields.
   - With `INTERNSCRAPER_URL` unset, or on any failure/timeout (30 s), the post goes to `pending_review` (fail closed).
2. Vectorisation: pipeline auto-approvals are sent to the vectoriser by **internScraper** (`POST /vectorize-platform`); moderator approvals are sent by **ifind** (`vectorizeIfApproved()` in the moderator route). The vectoriser writes the vectors onto the same document, adds it to the HNSW graph and runs every student through the graph (see `internScraper/pipeline-diagram.md`).
3. Resuming from `paused` keeps the existing moderation result.
4. Editing a published/paused internship: if `name`, `stipend`, `summary`, `skills` or `applyLink` changed, vectors are cleared and the listing goes back through the pipeline (it may auto-approve again); other edits do nothing.
5. Moderators: `InternshipsPanel` has a Scraped / Employer-posted switch. `GET /api/moderator/internships?source=employer` lists non-draft posts; `PATCH /api/moderator/internships/[id]` with `source: "employer"` approves (`manually_approved`, then vectorized) or rejects (`manually_rejected`, reason required). All company members are notified.
6. Employers see only the outcome and rejection reason, never the scam score or flags.

## 6. Pages

```
/employer                                   public landing
/employer/login, /employer/register         public
/employer/companies | companies/new | profile | settings | notifications     (global shell)
/employer/company/[companyId]/{overview, internships, post-new-internship, applicants, team, settings}
/employer/company/[companyId]/internships/[internshipId]/{applicants, internship-details, overview, settings} (the bare internship URL redirects to the most useful tab; `students-applied` redirects to `applicants`)
```
Layouts: `app/employer/(app)/layout.tsx` (account check + `EmployerShell`), `company/[companyId]/layout.tsx` (membership check + `CompanySidebar`), `internships/[internshipId]/layout.tsx` (`InternshipTabs`). The global sidebar collapses to icons inside a company; below 768px both sidebars are drawers.

## 7. APIs

All return `{ success, data? , error? }`, `runtime = "nodejs"`. "Min role" is enforced server-side.

| Route | Methods (min role) |
|---|---|
| `/api/employer/auth/{register,login,logout,me,linkedin}` | public (me checks session) |
| `/api/employer/profile` | GET, PATCH |
| `/api/employer/account` | DELETE (blocked for sole owners) |
| `/api/employer/account/password` | POST (set or change) |
| `/api/employer/account/linkedin` | DELETE (needs a password set) |
| `/api/employer/notifications` | GET (`?countOnly=1`), PATCH `{id}` or `{all:true}` |
| `/api/employer/uploads` | POST image (JPG/PNG/WebP, 2MB) -> ImageKit URL |
| `/api/employer/companies` | GET, POST |
| `/api/employer/companies/[companyId]` | GET (recruiter), PATCH (admin), DELETE (owner) |
| `.../members` | GET (recruiter), POST/PATCH (admin; owners need owner), DELETE (admin; anyone may remove self) |
| `.../internships` | GET (`?status=`), POST (draft) |
| `.../internships/[internshipId]` | GET, PATCH (full replace of form fields), DELETE (draft only) |
| `.../internships/[internshipId]/[action]` | POST `publish`, `pause`, `close`, `archive`, `duplicate` |
| `.../internships/[internshipId]/applications` | GET (`status`, `q`, `sort=date|match|rating`) |
| `.../applications` | GET company-wide (+ `internshipId`) |
| `.../applications/[applicationId]` | GET, PATCH `{status?, rating?, note?}` |
| `.../applications/[applicationId]/notes` | POST |
| `.../applications/bulk-status` | POST `{ids, status}`; per-item result `{updated, failed}` |

Cross-company access is always 404 (company id is part of every child query). The audit results are in `PROGRESS-employer.md`.

## 8. Environment variables

| Variable | Needed | Notes |
|---|---|---|
| `EMP_JWT_SECRET` | yes | Signs employer sessions. Missing -> the server throws on first use. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `MONGODB_URI` | yes | Existing. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (or `LinkedIn_OAUTH_API`), optional `LINKEDIN_REDIRECT_URI` | for LinkedIn | Existing; the same redirect URI serves students and employers. |
| `IMAGEKIT_PRIVATE_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | for logos | Existing. Company logo/cover URLs must start with the endpoint. |
| `INTERNSCRAPER_URL` | optional | Base URL of internScraper (e.g. the Render service). Unset -> every employer post goes to `pending_review`. internScraper itself needs `FIRST_PARTY_DOMAINS` set to iFind's domain(s) for employer posts to be able to auto-approve. |
| `INTERNSCRAPER_API_KEY` | optional | Sent as `x-api-key`; must match internScraper's `INTERNSCRAPER_API_KEY` if that is set. |
| `VECTORIZER_URL` | optional | Base URL of the vectorizer (tf-idfs+berts). Default is the existing HF Space. Used for moderator approvals, resume/profile changes and the admin refresh. |

## 9. Scripts

`npx tsx scripts/seed-applications.ts <internshipId> [count]` creates fake applications from existing users (writes to `MONGODB_URI`; the internship must be published). `--clean <internshipId>` removes only what it created.

## 10. Touched outside the employer area

- `models/Internship.ts` / `types/internship.ts`: `listingFields` exported; `"employer"` added to the moderation `source` enum; `source` is now required and an enum (`INTERNSHIP_SOURCES` plus the legacy `web_scraping` until `internScraper/backfill_source.py --apply` is run).
- `lib/internship-vectorizer.ts`: `vectorizePlatformInternships()`.
- `app/api/auth/linkedin/*`: employer intents, and the state check is now enforced (this also closes an existing CSRF gap for students).
- `proxy.ts`: employer guards and matcher entries.
- Moderator: `InternshipsPanel`, `ModerationQueueCard`, `types/moderator.ts`, `app/api/moderator/internships/route.ts` and `[id]/route.ts` (employer source only).
- `components/auth/LinkedInButton.tsx`: optional `as` prop.

## 11. Student side (built in PROMPT-recruitment)

1. **Feed.** `GET /api/user/dashboard` merges scraped listings with `visibleToStudentsFilter()` posts via `toStudentInternship()` (`lib/employer/visibility.ts`): `source: "ifind"`, `applyLink: ""`, `companyLogo`, `requireResume`, `requireCoverLetter`, `screeningQuestions`; no vectors or moderation data. Saved / recommended / applied lookups search both collections.
2. **Browse UI.** Source filter (`filters.sources`, `SOURCE_LABELS` in `lib/constants.ts`), green `StipendBadge` for paid, `ApplyButton` (`Apply on {Source}` for scraped, `Apply` for iFind, with `ApplyDialog` behaviour for cover letter / screening questions), no source-site link buttons.
3. **APIs.** `POST|DELETE /api/internships/[id]/save`; `POST /api/internships/[id]/apply`. Scraped id: recorded on `user.appliedInternships`. iFind id: re-checks visibility, `requireResume`, `requireCoverLetter`, answers (`lib/employer/screening.ts`), then `createApplication()` (409 on duplicate) and records it on the user.
4. **Status loop.** `changeStatus()` mirrors the pipeline status onto `user.appliedInternships[].status` (shortlisted/interview/offered -> shortlisted, hired -> selected, rejected -> rejected) and writes a `notifications.student` row (`application_status`) except for `under_review`.

Still open: a student bell/page for `notifications.student`; withdraw (`status: "withdrawn"` + `application_withdrawn` to the company); a student-facing status timeline (never expose `notes`, `rating`, `statusHistory.changedBy`; do not reuse `EmployerApplication`); vector-based `matchScore` (`computeMatchScore()` is skill overlap); recommendations now run in the vectoriser (`tf-idfs+berts/vectoriser/recommender.py`), including employer posts.

## 12. Known gaps

No login rate limiting; no email verification for password signups; company verification is a status/badge only (no workflow); no interview scheduling, messaging, outgoing email, billing or public company pages; `Model.syncIndexes()` has not been run (manual step).
