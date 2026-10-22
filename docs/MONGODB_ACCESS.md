# MongoDB access model

MongoDB has no row-level security and no client keys: the browser never talks to the database. The only client is
this server, over one connection string, so **every access rule lives in route code**. A bug in a route is a bug in
the database's access control. This file records the rules and how they are tested.

## Rules every query must follow

1. **Identity comes from the session, never the request.** `getSession()` / `getValidEmployer()` / `getModSession()` supply the user, employer or moderator id. A body, query or path value may select *which of your own* rows to act on, and the filter must still include the session id (`{ _id: id, userId: session.userId }`).
2. **Type-check ids before querying.** `isObjectId(value)` (lib/validate.ts) rejects objects like `{"$gt": ""}`, which Mongoose would otherwise treat as an operator and match another user's document. Use `str(value, max)` for strings.
3. **Never `$set` or `create` from a request body.** Build the update from an explicit allowlist, or parse with a zod schema (zod drops unknown keys). Fields clients must never write: `role`, `isBanned`, `isVerified`, `dailyCreditLimit`, `tokenVersion`, `password`, `linkedinId`, `userId`, `companyId`, `moderation`, `verification`, `members`.
4. **The raw driver ignores the schema.** `mongoose.connection.db.collection(...)` bypasses `select: false`, `strict` and validation. Always pass a `projection` that removes `password`, `failedLoginAttempts`, `tokenVersion` and the vectors.
5. **Tenant scoping for employers.** Company data is reached only through `requireCompanyRole(companyId, minRole)`, which loads the company and checks the employer's membership. Application and internship queries also carry `companyId`.

## Collections

| Collection | Who touches it | Scope key | Client-writable fields |
|---|---|---|---|
| `users` | student routes, auth, moderators | session user id | profile allowlist in `app/api/user/profile` only |
| `employers` | employer routes, auth, moderators | session employer id | name, phone, designation, picture |
| `moderators` | moderator routes | session moderator id; moderators act on others | none by clients |
| `companies` | employer routes (membership), moderators | `members.employerId` | zod `companySchema` fields |
| `internships.this-platform` | employer routes (`companyId`), students read approved | `companyId` | zod `internshipDraftSchema` fields |
| `applications` | students create own; employers by `companyId` | `studentId` / `companyId` | cover letter, answers |
| `internships`, `internships.mod-unvectorised`, `scrape.runs` | scraper and vectoriser; students read; moderators | none (shared catalogue) | none by clients |
| `jobdescriptions`, `jobmatches`, `analyses` | student routes | `userId` | allowlisted fields |
| `chatsessions`, `chatmessages` | student routes | `userId` (messages via owned session) | title, archive flag, message text |
| `notifications.student` / `.employer` / `.moderator` | each role | `recipientId` | read flag only |
| `events`, `usage.*`, `llm.usage`, `ban.events` | server and moderators | none | none by clients |
| `ratelimits` | rate limiter | key | none (TTL index) |

Tests for these rules: `tests/security.e2e.test.ts`, groups "record ownership and mass assignment", "MongoDB access control" and "role separation".

## Atlas: least privilege

The application database user should be able to read and write only the collections above and nothing administrative.
Replace `<DB>` with your database name and run in `mongosh` as an Atlas admin; then create the user with this role and
remove `readWriteAnyDatabase`/`atlasAdmin` from any user the app uses.

```js
use admin
db.createRole({
  role: "ifindApp",
  privileges: [{
    resource: { db: "<DB>", collection: "" },
    actions: ["find", "insert", "update", "remove", "createIndex", "createCollection"]
  }],
  roles: []
})
// no dropCollection, dropDatabase, createUser, grantRole, or any cluster action
db.createUser({ user: "ifind-app", pwd: passwordPrompt(), roles: [{ role: "ifindApp", db: "admin" }] })
```

Also in Atlas: restrict **Network Access** to your Vercel egress or a private endpoint instead of `0.0.0.0/0`, give the
scraper and the vectoriser their **own** users (each limited to the collections it writes), and turn on database auditing
and a backup policy. `createIndex`/`createCollection` are needed while Mongoose auto-creates indexes at startup; once
indexes are created by a migration, drop those two actions and set `autoIndex: false`.

Not verified here: the actual Atlas roles and IP list (no Atlas access), and which collections the scraper and vectoriser
use (their submodules are not checked out in this workspace).
