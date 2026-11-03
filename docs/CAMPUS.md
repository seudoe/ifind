# Campus internships

On-campus, post-and-apply internships run by a college's placement team, for that college's students. Everything lives in
`ifind`. `internScraper`, `vectoriser` and `resume-extractor-v3` are unchanged (see 11). Related: [EMPLOYER.md](EMPLOYER.md),
[STUDENT.md](STUDENT.md).

## 1. How it works

- An employer account creates a **campus** (a college "placement cell") for a college from the `colleges` collection, and
  adds staff with a role. Anyone can create a campus of any college and many can coexist: nobody can prove they are the
  official cell, so authenticity is social. Each campus has an 8-character **join code** the real coordinator shares
  (WhatsApp); students see who created each campus and how many students **reported** it.
- A student fills college details (works with no campus), joins **one** campus, then sees its internships, events and
  applications. Staff post internships (company first; most details arrive later as events), review applicants, post
  events, remove or bar students, and export applicants for the real recruiters.
- Campus data never enters the scraper, scam moderation, vectoriser, recommendations, the dashboard feed or the public
  listing (`lib/publicInternships.ts`).

## 2. Collections (models in `models/`, enums in `types/campus.ts`)

| Collection | Model | Notes |
|---|---|---|
| `colleges` | `College` | Read-only, owner-populated, one doc per college. Only `_id` and `name` are assumed. The app never writes, indexes or migrates it. |
| `colleges.entities` | `CampusEntity` | The campus: profile, `joinCode` (unique, rotatable), `listing` (listed / code_only), `members[{employerId, role}]`, `policy`, `restriction`, `reportCount`, `studentCount`. No uniqueness on `collegeId`. |
| `colleges.students` | `CampusEnrollment` | `userId` unique. `entityId` null until joined. `collegeUid` is self-declared and **not** unique (staff see a duplicate badge). `emailUpdates` (default on), `smsUpdates` (default off). |
| `colleges.entity-reports` | `CampusEntityReport` | One per (campus, student). Never auto-deletes anything. |
| `colleges.blacklist` | `CampusBlacklist` | Per campus; one active row per student (partial unique index); lifted rows kept. |
| `campus-internships` | `CampusInternship` | `draft / open / closed / archived`. `emailedAt` (announced once), `remindedAt`. |
| `campus-internships.events` | `CampusEvent` | `version` (bumped on a material change), `notifiedAt`, `remindedVersion`. Not the hackathon `Event`. |
| `campus-internships.applications` | `CampusApplication` | Unique `(internshipId, studentId)`. Statuses below. Staff `notes` and `rating` are never sent to students or exported. |
| `notifications.college` | `CollegeNotification` | Staff inbox shared by a campus (read state per member). |
| `messaging.outbox` | `OutboundMessage` | Every email/SMS, with status, attempts, `sentAt`, `failedAt`, `lastError`, `nextAttemptAt`. |

No change to `Internship`, `PlatformInternship`, `Application`, `User` or `Company`. `BanEvent.targetType` also accepts
`"campus"`; the notification type list gained the `campus_*` types (all inbox-only priority).

## 3. Roles (campus staff)

`viewer < coordinator < admin < owner`; enforced server-side by `requireCampusRole(entityId, minRole)` (non-members get 404).

| Role | Can |
|---|---|
| viewer | read internships, events, applicants, students, team |
| coordinator | post/edit internships and events, move applicants, remove from an internship, bar/unban, remove students, **export** |
| admin | team (non-owners), settings, join code rotation |
| owner | everything, delete the campus, manage owners |

A campus always keeps at least one owner (atomic conditional updates; the last owner cannot leave or be demoted, and an
account that is the sole owner cannot be deleted).

## 4. State machines

- **Internship:** `draft -> open -> closed -> archived`. A draft needs only company + designation; publishing needs a future
  deadline. Open ones auto-close lazily at the deadline or when `maxApplications` is reached (no scheduler). Closed and
  archived are read-only (duplicate to post again).
- **Application:** `applied | shortlisted | in_process | offered | accepted | declined | rejected | withdrawn | removed`.
  Final = `withdrawn, rejected, declined, removed`; everything else is **active**. Staff moves are in
  `CAMPUS_APPLICATION_TRANSITIONS`; students can withdraw (any active status; an accepted offer needs an extra
  confirmation), accept or decline an offer. All changes are conditional updates (409 on a concurrent change).
  *Removed* (from one internship) is not a ban; reinstate returns it to `applied`.
- **Student and campus:** one student, one campus. Joining needs the "I am certain" confirmation; switching shows the red
  warning; **leaving or switching is refused while any application is active** (`409 has_active_applications`). Leaving is
  always allowed once the campus is deleted or banned (its applications were withdrawn).
- **Restriction (moderator):** `none -> restricted -> banned` and back. Restricted/banned: cannot post, **cannot email or
  text** (central check in `lib/campus/outbound.ts`), cannot accept joins or applications. Banned also closes internships,
  withdraws applications and detaches students; staff still see the campus with a red notice.

## 5. Messaging (email and SMS are stubs)

Campus code never calls a provider. The only seams are `dispatchEmail()` (`lib/messaging/email.ts`) and `dispatchSms()`
(`lib/messaging/sms.ts`): one recipient per call, idempotent on `idempotencyKey`, never throw, **empty today** (they return
`{ ok:false, skipped:"not_implemented" }`). Wording is in `lib/campus/messages.ts`; fan-out in `lib/campus/outbound.ts`.

Every message is written to `messaging.outbox` **before** it is sent and updated after: `sent` (with `sentAt`) or `failed`
(with `failedAt`, `lastError`, `nextAttemptAt`). With the stub, every email is stored as `failed / not_implemented`, so
nothing is lost. A retry job should pick rows with `status: "failed"` (or old `pending`) and `nextAttemptAt <= now`, call
`dispatchEmail`, then `finishOutbox()` from `lib/messaging/outbox.ts`. The same `(channel, idempotencyKey)` is never claimed
twice, so a new event version or status change creates a new row and a repeat does not.

Audiences honour `emailUpdates` / `smsUpdates` (SMS also needs a phone), skip banned accounts and blacklisted students, and
are suppressed entirely for a restricted campus.

## 6. Pages

- Employer: `/employer/institutes` (companies + colleges, filter, "College" badge and teal accent), `/employer/institutes/new`
  (chooser), `/employer/institutes/new/campus`. `/employer/companies*` redirects. Workspace `/employer/campus/[entityId]/`
  `overview, internships, post-new-internship, events, students (+ Blacklist), team, settings`; per internship
  `applicants, events, details, settings`.
- Student: `/user/[username]/campus/` `Home, Campuses, Internships, Applied (+ /[id]), College details`. A yellow banner shows
  on every tab until a campus is joined. Campus applications also appear on the main Applied page with a "Campus" badge.
- Moderator: `/moderator/[username]/campuses`.

## 7. APIs

All JSON `{ success, data?, error?, code? }`, Node runtime. Staff routes take the campus from the verified membership, never
from the request; student routes take it from the enrollment.

- **Staff** `employer/campus[/ [entityId] ]`: entity (`GET` viewer, `PATCH` admin, `DELETE` owner), `code/rotate`, `members`,
  `students` (+ `[studentId]/remove`), `blacklist`, `internships` (+ `[internshipId]`, `[action]` publish/close/archive/duplicate,
  `extract`), `events` (+ `[eventId]`, `cancel`), `applications` (+ `[applicationId]`, `notes`, `remove`, `reinstate`,
  `bulk-status`), `export?format=csv|xlsx|json&internshipId=`. Also `employer/institutes`, `employer/colleges/search|entities`.
- **Student** `user/campus/...`: `state, colleges, enrollment, preferences, home, entities (+ join, leave, lookup, [id]/report),
  internships (+ [id], [id]/apply), applications (+ [id], [id]/respond, [id]/withdraw), events/[id]/ics`.
- **Moderator** `moderator/campuses[/ [id] ]`. **Cron** `GET cron/campus-reminders`.

## 8. Notable behaviours

- **Paragraph to details:** `POST .../internships/extract` sends the pasted notification to Gemini (same provider, billing and
  burst limits as resume features, feature `campus-extract`, 2 credits). The text is fenced as data; the answer is parsed as JSON
  and each field validated with the form's own schema; dates without a zone are IST. Nothing is saved or published automatically.
- **Export:** CSV (UTF-8 BOM), XLSX (`write-excel-file`), JSON. Cells starting with `= + - @ tab CR` get a leading `'`. No staff
  notes or ratings. 20 per hour per employer; logged without personal data.
- **Events:** audiences `all_members, eligible, applicants, shortlisted, round:<name>, batch:<year>`; one predicate
  (`audienceIncludes`) decides both who is messaged and what a student sees. Only time/venue/link/mode changes re-notify.
  Student feed tags: *You applied*, *Open to you*, muted when ineligible. ICS files are escaped and folded.
- **Reminders:** 24 h before events and before an internship's deadline (to eligible students who have not applied).

## 9. Environment, scripts, tests

- **Env:** `CRON_SECRET` only (cron returns 503 while it is empty). Email/SMS provider keys are added later, when the two
  stubs are implemented.
- **Scripts:** `npx tsx scripts/ensure-campus-indexes.ts` (creates the campus indexes; never touches `colleges`),
  `npx tsx scripts/inspect-colleges.ts` (read-only shape check).
- **Tests:** `npm run test:campus` (about 95 tests, in-memory MongoDB). `tests/campus-routes-audit.test.ts` statically checks every
  campus route for authentication, runtime, rate limits on every write handler, no client-supplied campus, and no PII in logs.

## 10. Known gaps

- `dispatchEmail` / `dispatchSms` and the retry job are not implemented (messages accumulate in the outbox).
- No staff override of "one student, one offer"; a lapsed offer needs staff to act.
- Billing/quota for `campus-extract` shares the daily credit pool (employer ids are separate subjects).
- The `colleges` collection must be populated by the owner; students cannot add a missing college.

## 11. Why internScraper and vectoriser are unchanged

They read only `internships`, `internships.mod-unvectorised`, `internships.this-platform`, `internships.graph`, `users`, `events`,
`scrape.runs`, `llm.usage`, `usage.*`. None enumerates collections by pattern (the only `list_collection_names` is a test that
drops a non-production test database). Campus data is in `campus-internships*`, `colleges*`, `messaging.outbox`, so they can
never see it, and campus posts are not recommended.
