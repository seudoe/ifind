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

## Next
- Stage 2: employer auth (needs EMP_JWT_SECRET).
