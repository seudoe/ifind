# PROGRESS: student side

Spec: `../PROMPT-student-side.md`. Docs: `docs/STUDENT.md`.

| Stage | Commit subject | Status |
|---|---|---|
| 1 Persistent layout | Student Stage 1 | done |
| 2 Grouped navigation, sidebar, mobile | Student Stage 2 | done |
| 3 Student notifications | Student Stage 3 | done |
| 4 Applied internships + timeline + withdraw | Student Stage 4 | done |
| 5 Docs and cleanup | Student Stage 5 | done |

Verified: `tsc --noEmit` clean; applications / notifications / withdraw APIs against the dev server with a
temporary student, company and application (all removed afterwards): list, detail, timeline, no employer-note leak,
other student's id -> 404, unread count and mark read, withdraw (200, repeat 409), employer notification, unauthenticated 401.

Not verified by eye (needs a logged-in browser): the sidebar, mobile sheet and timeline visuals.

## QA checklist (logged in as a student)
- [ ] Desktop (>= 1024 px): sidebar shows Home, Internships (Browse, Applied, Saved), Tools (Resume Analyzer,
      Career Assistant, Chat), System (Profile, Settings, Notifications); active link highlighted.
- [ ] Switching tabs keeps the sidebar mounted and does not call `/api/user/dashboard` again (Network tab).
- [ ] Mobile (360 px): top bar with bell + avatar; bottom bar Home / Internships / Tools / System; groups open a sheet,
      tapping a link closes it; System sheet has Logout; no horizontal scroll; the vectorization toast clears the bar.
- [ ] Browse: the Filters button shows only on mobile and opens the filter sheet.
- [ ] Notifications: unread badge in the sidebar and bell; opening one or "Mark all read" clears it.
- [ ] Employer moves an application: student gets a notification linking to the application page.
- [ ] Applied: list shows status chips; iFind application shows the timeline with dates; scraped shows "Applied on {source}".
- [ ] Applied button on a card / pop-up opens the application page.
- [ ] Withdraw: confirm step, status becomes Withdrawn, button disappears, employer sees the withdrawn status and a notification.
- [ ] Old floating chat button is gone; Chat reachable under Tools.
