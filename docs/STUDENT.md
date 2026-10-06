# Student area

Everything under `/user/[username]/` shares one layout (`app/user/[username]/layout.tsx`): `StudentProvider`
fetches `/api/user/dashboard` once and every page reads it with `useStudentDashboard()` (`data`, `error`,
`loading`, `mutate`). Switching tabs swaps only the content; call `mutate()` after a change that affects the
dashboard data (profile, resume, apply, withdraw).

## Navigation

`lib/student-nav.ts` is the single list (sidebar, bottom bar, page titles). Grouping is UI only; each link keeps its URL.

| Group | Links (path under `/user/[username]/`) |
|---|---|
| Home | `overview` |
| Internships | `browse`, `applied-internships` (+ `/[internshipId]`), `saved` |
| Tools | `resume`, `career`, `chat` (`internship-match` is reachable, not listed) |
| System | `profile`, `settings`, `notifications` |

- `lg+`: fixed left sidebar with the groups, profile completion, avatar and logout.
- `<lg`: top bar (logo, bell with unread count, avatar) and a bottom bar with the four groups. Home navigates;
  the other groups open a sheet with their links (System also has Logout).
- A link is active when the path equals it or sits below it (`applied-internships/[id]` highlights Applied).

## APIs (session cookie, student only)

| Route | Purpose |
|---|---|
| `GET /api/user/dashboard` | user, browse feed, saved, recommended, applied internships |
| `GET /api/user/notifications` (`?countOnly=1`) / `PATCH {id}` or `{all:true}` | `notifications.student` |
| `GET /api/user/applications` | applied internships with pipeline status |
| `GET /api/user/applications/[internshipId]` | one application: timeline, cover letter, answers, `canWithdraw` |
| `POST /api/user/applications/[internshipId]/withdraw` | withdraw an open iFind application (final) |
| `POST /api/internships/[id]/apply`, `POST/DELETE /api/internships/[id]/save` | see `docs/EMPLOYER.md` section 11 |

Student-facing application data never includes employer notes, ratings or `changedBy`
(`lib/student-applications.ts` builds the shape; `types/student-application.ts` has the types).

## Applied internships

- iFind posting: status comes from `Application` (`applied -> under_review -> shortlisted -> interview -> offered -> hired`,
  or `rejected` / `withdrawn`). The page draws the reached stages with dates and the stages still ahead.
- Scraped listing: only "applied on {source}" with the date and a link out; the source site owns the status.
- Withdraw is allowed while the status is not `hired`, `rejected` or `withdrawn`. It sets `withdrawn`, mirrors it on
  `user.appliedInternships[].status`, and notifies the company (`application_withdrawn`). Because
  `(internshipId, studentId)` is unique, a withdrawn application cannot be re-applied.
