# Recruitment progress (PROMPT-recruitment.md)

All six stages are done and committed. API paths below were tested against the dev server with `zz-` data (cleaned up); the UI was only type-checked and compile-checked, not clicked through.

| Stage | Result |
|---|---|
| 1 | `GET /api/user/dashboard` merges scraped + approved employer posts (`toStudentInternship`) |
| 2 | Source filter (with counts) in browse |
| 3 | Green paid-stipend badge, source label, `Apply on {Source}` / `Apply`, link buttons removed |
| 4 | `POST|DELETE /api/internships/[id]/save`, `POST /api/internships/[id]/apply`, apply dialog for cover letter / screening questions |
| 5 | Internship workspace sub-tabs (Applicants, Internship details, Overview, Settings) with Back; bare URL redirects to the best tab; `students-applied` renamed `applicants` (old path redirects) |
| 6 | Status changes mirror to `user.appliedInternships[].status` and write `notifications.student` |

## Manual QA checklist

Student
- [ ] Browse shows an approved, published employer post; a paused / pending / rejected / expired one is absent.
- [ ] Source filter lists iFind + scrapers, counts match, selecting one narrows the list, "Clear filters" resets it.
- [ ] Paid stipend is a green pill on grid card, list card, pop-up and mobile detail; unpaid is plain text.
- [ ] Scraped card says "Apply on Internshala" (etc.) and opens the source site; iFind card says "Apply".
- [ ] No external-link icon / "Original Link" button anywhere.
- [ ] iFind post with a cover letter / questions opens the dialog; empty required fields show an inline error; submit shows "Applied" at once and survives a reload.
- [ ] iFind post without questions applies in one click.
- [ ] Applying twice is blocked; applying to a post the employer just paused shows an error.
- [ ] Save / unsave works for both kinds; saved tab shows employer posts.

Employer
- [ ] The application shows in Applicants with answers and cover letter; the company gets a "New application" notification linking to Applicants.
- [ ] Internships list -> click a row: sub-tabs + Back replace the status tabs; Back returns to All / Draft / ...
- [ ] Draft opens on Internship details; post with applicants opens on Applicants; otherwise Overview.
- [ ] After publishing a new internship you land on Internship details with the saved post.
- [ ] Sidebar "Internships" stays highlighted on every sub-tab.
- [ ] Shortlist / interview / reject: the student's Overview "Applied" list status changes and a `notifications.student` row exists (no student bell UI yet).

## Known gaps
- No student notifications UI, no withdraw, no student status timeline.
- Employer posts are not in the HNSW graph (not recommended), only browsable.
