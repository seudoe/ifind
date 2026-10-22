/**
 * End-to-end security checks against a real production build (`next start`) backed by an in-memory MongoDB, so
 * nothing here can touch a real database. Run with: npm run build && npm run test:e2e
 *
 * Covers: unauthenticated access, role separation (student / employer / moderator), record ownership (IDOR),
 * mass assignment, id validation, rate limiting, account-enumeration parity, CSRF, upload validation,
 * response minimisation and the security headers.
 */
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";

const PORT = 3950;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "Passw0rdTest";

let server: ChildProcess;
let mongo: { stop: () => Promise<boolean>; getUri: () => string };
let serverLog = "";

/**
 * Next loads `.env` itself, and a developer's `.env` holds real credentials. dotenv never overrides a variable that
 * already exists in the process environment (even as ""), so blank every name defined there: the test server must not
 * be able to reach real databases, storage, AI providers or companion services.
 */
function blankedDotEnv(): Record<string, string> {
  const blanks: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) blanks[m[1]] = "";
  }
  return blanks;
}

type Jar = Record<string, string>;
const cookieHeader = (jar: Jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

async function call(path: string, init: RequestInit & { jar?: Jar; json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (init.jar && Object.keys(init.jar).length) headers.set("cookie", cookieHeader(init.jar));
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, body, redirect: "manual" });
  const setCookies = res.headers.getSetCookie();
  if (init.jar) {
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      init.jar[pair.slice(0, i)] = pair.slice(i + 1);
    }
  }
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, data, text, headers: res.headers, setCookies };
}

// Registration is limited to 10/hour per IP. The server trusts x-forwarded-for when no platform header is set,
// so give each registration its own address (this also shows why the limiter must sit behind a trusted proxy).
let nextIp = 1;
async function registerStudent(username: string) {
  const jar: Jar = {};
  const r = await call("/api/auth/register", {
    method: "POST",
    jar,
    headers: { "x-forwarded-for": `10.1.0.${nextIp++}` },
    json: { name: `User ${username}`, username, email: `${username}@example.com`, password: PASSWORD, city: "Pune" },
  });
  assert.equal(r.status, 201, `register ${username}: ${r.text}`);
  return jar;
}

before(async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
  const uri = `${mongo.getUri()}ifind-e2e`;

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      ...blankedDotEnv(),
      MONGODB_URI: uri,
      JWT_SECRET: "e2e-student-secret-0123456789abcdef0123456789",
      MOD_JWT_SECRET: "e2e-moderator-secret-0123456789abcdef012345",
      EMP_JWT_SECRET: "e2e-employer-secret-0123456789abcdef012345",
      NEXT_PUBLIC_APP_URL: BASE,
      NEXT_PUBLIC_GA_ID: "",
      BREACH_CHECK: "off", // no calls to third-party services from tests
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (d) => (serverLog += d));
  server.stderr?.on("data", (d) => (serverLog += d));

  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/robots.txt`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
    if (i === 59) throw new Error(`server did not start:\n${serverLog}`);
  }
  await mongoose.connect(uri);
});

after(async () => {
  server?.kill();
  await mongoose.disconnect().catch(() => {});
  await mongo?.stop();
});

describe("unauthenticated access", () => {
  for (const [method, path] of [
    ["GET", "/api/auth/me"],
    ["GET", "/api/user/dashboard"],
    ["GET", "/api/chat/sessions"],
    ["GET", "/api/job-descriptions"],
    ["PUT", "/api/user/profile"],
    ["POST", "/api/user/upload-picture"],
    ["POST", "/api/user/delete-account"],
    ["GET", "/api/employer/profile"],
    ["GET", "/api/employer/companies"],
    ["GET", "/api/moderator/users"],
    ["POST", "/api/admin/rebuild-index"],
    ["POST", "/api/admin/refresh-recommendations"],
  ] as const) {
    it(`${method} ${path} -> 401`, async () => {
      const r = await call(path, { method, json: method === "GET" ? undefined : {} });
      assert.equal(r.status, 401, r.text);
    });
  }

  it("moderator/employer pages redirect to their login", async () => {
    assert.equal((await call("/moderator/someone/users")).headers.get("location")?.includes("/moderator/login"), true);
    assert.equal((await call("/employer/companies")).headers.get("location")?.includes("/employer/login"), true);
  });
});

describe("role separation", () => {
  it("a student cookie grants nothing on employer, moderator or admin APIs", async () => {
    const student = await registerStudent("rolestudent");
    assert.equal((await call("/api/employer/profile", { jar: student })).status, 401);
    assert.equal((await call("/api/moderator/users", { jar: student })).status, 401);
    assert.equal((await call("/api/admin/rebuild-index", { method: "POST", jar: student })).status, 401);
  });

  it("an unverified moderator is refused on admin endpoints", async () => {
    const jar: Jar = {};
    const reg = await call("/api/moderator/auth/register", {
      method: "POST",
      jar,
      json: { name: "Mod One", email: "mod1@example.com", password: PASSWORD },
    });
    assert.ok(reg.status === 201 || reg.status === 200, reg.text);
    const r = await call("/api/admin/rebuild-index", { method: "POST", jar });
    assert.ok(r.status === 401 || r.status === 403, `unverified moderator got ${r.status}`);
  });

  it("an employer cookie does not authenticate as a student", async () => {
    const jar: Jar = {};
    const reg = await call("/api/employer/auth/register", {
      method: "POST",
      jar,
      json: { name: "Emp One", email: "emp1@example.com", password: PASSWORD },
    });
    assert.equal(reg.status, 201, reg.text);
    assert.equal((await call("/api/employer/profile", { jar })).status, 200);
    assert.equal((await call("/api/auth/me", { jar })).status, 401);
    assert.equal((await call("/api/user/dashboard", { jar })).status, 401);
  });
});

describe("record ownership and mass assignment", () => {
  it("users cannot read, change or delete each other's chat sessions", async () => {
    const a = await registerStudent("ownera");
    const b = await registerStudent("ownerb");
    const created = await call("/api/chat/sessions", { method: "POST", jar: a, json: { resumeId: "current", title: "A's chat" } });
    assert.equal(created.status, 200, created.text);
    const id = (created.data?.data as { _id: string })._id;

    assert.equal((await call(`/api/chat/sessions/${id}`, { jar: a })).status, 200);
    assert.equal((await call(`/api/chat/sessions/${id}`, { jar: b })).status, 404);
    assert.equal((await call(`/api/chat/sessions/${id}`, { method: "PATCH", jar: b, json: { title: "pwned" } })).status, 404);
    assert.equal((await call(`/api/chat/sessions/${id}`, { method: "DELETE", jar: b })).status, 404);
    assert.equal((await call(`/api/chat/messages?sessionId=${id}`, { jar: b })).status, 404);
    // still intact for the owner
    const still = await call(`/api/chat/sessions/${id}`, { jar: a });
    assert.equal(((still.data?.data as { session: { title: string } }).session).title, "A's chat");
  });

  it("job-description PUT ignores userId and unknown fields, and is scoped to the owner", async () => {
    const a = await registerStudent("jda");
    const b = await registerStudent("jdb");
    const me = await call("/api/auth/me", { jar: a });
    const aId = ((me.data?.data ?? me.data?.user ?? me.data) as { _id?: string; id?: string })._id!;
    const bMe = await call("/api/auth/me", { jar: b });
    const bId = ((bMe.data?.data ?? bMe.data?.user ?? bMe.data) as { _id?: string })._id!;
    assert.ok(aId && bId);

    const JD = mongoose.connection.collection("jobdescriptions");
    const { insertedId } = await JD.insertOne({
      userId: new mongoose.Types.ObjectId(aId),
      title: "Original",
      company: "Acme",
      description: "x",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const id = String(insertedId);

    assert.equal((await call(`/api/job-descriptions/${id}`, { method: "PUT", jar: b, json: { title: "hacked" } })).status, 404);

    const mine = await call(`/api/job-descriptions/${id}`, {
      method: "PUT",
      jar: a,
      json: { title: "Renamed", userId: bId, isAdmin: true },
    });
    assert.equal(mine.status, 200, mine.text);
    const row = await JD.findOne({ _id: insertedId });
    assert.equal(row?.title, "Renamed");
    assert.equal(String(row?.userId), aId, "userId must not be client-writable");
    assert.equal("isAdmin" in (row ?? {}), false);

    assert.equal((await call(`/api/job-descriptions/${id}`, { method: "PUT", jar: a, json: { title: { $gt: "" } } })).status, 400);
  });

  it("profile PUT rejects unknown resume sections, bad types and non-http avatars", async () => {
    const a = await registerStudent("profilea");
    const put = (json: unknown) => call("/api/user/profile", { method: "PUT", jar: a, json });
    assert.equal((await put({ resumeUpdate: { evil: 1 } })).status, 400);
    assert.equal((await put({ resumeUpdate: { "metaDetails.$where": 1 } })).status, 400);
    assert.equal((await put({ userUpdate: { name: { $ne: "" } } })).status, 400);
    assert.equal((await put({ userUpdate: { username: "Bad Name!" } })).status, 400);
    assert.equal((await put({ userUpdate: { profilePicture: "javascript:alert(1)" } })).status, 400);
    assert.equal((await put({ userUpdate: { skills: "notalist" } })).status, 400);
    // Resume sections need an extracted resume first: a clear 400, not a database error.
    assert.equal((await put({ resumeUpdate: { summary: "hello" } })).status, 400);

    const ok = await put({ userUpdate: { city: "Mumbai", skills: ["react", "node"] } });
    assert.equal(ok.status, 200, ok.text);

    const me = await call("/api/auth/me", { jar: a });
    const userId = ((me.data?.data ?? me.data?.user ?? me.data) as { _id: string })._id;
    await mongoose.connection
      .collection("users")
      .updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { "resume.parsedData": { summary: "old", skills: [] } } });
    const resume = await put({ resumeUpdate: { summary: "hello" } });
    assert.equal(resume.status, 200, resume.text);
  });

  it("malformed ids return 404/400, never a 500", async () => {
    const a = await registerStudent("idsa");
    for (const path of [
      "/api/chat/sessions/not-an-id",
      "/api/chat/messages?sessionId=%7B%22%24ne%22%3A%22%22%7D",
      "/api/job-descriptions/zzz",
      "/api/internship-match/zzz",
    ]) {
      const r = await call(path, { jar: a });
      assert.ok([400, 404].includes(r.status), `${path} -> ${r.status}`);
    }
  });
});

describe("authentication behaviour", () => {
  it("login failures are indistinguishable for unknown account and wrong password", async () => {
    await registerStudent("enumuser");
    const unknown = await call("/api/auth/login", { method: "POST", json: { identifier: "nobody-here", password: PASSWORD } });
    const wrong = await call("/api/auth/login", { method: "POST", json: { identifier: "enumuser", password: "WrongPass1" } });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(unknown.data?.error, wrong.data?.error);
  });

  it("repeated bad logins for one account are rate limited (429 + Retry-After)", async () => {
    await registerStudent("bruteuser");
    const statuses: number[] = [];
    let last: Awaited<ReturnType<typeof call>> | undefined;
    for (let i = 0; i < 10; i++) {
      last = await call("/api/auth/login", { method: "POST", json: { identifier: "bruteuser", password: `Wrong${i}Pass1` } });
      statuses.push(last.status);
    }
    assert.ok(statuses.slice(0, 8).every((s) => s === 401), statuses.join());
    assert.equal(statuses[9], 429);
    assert.ok(last?.headers.get("retry-after"));
    // and the right password is also blocked while the window is hot (that is the point)
    const right = await call("/api/auth/login", { method: "POST", json: { identifier: "bruteuser", password: PASSWORD } });
    assert.equal(right.status, 429);
  });

  it("session cookie is HttpOnly, SameSite=Lax and Secure", async () => {
    const r = await call("/api/auth/register", {
      method: "POST",
      headers: { "x-forwarded-for": `10.1.0.${nextIp++}` },
      json: { name: "Cookie Test", username: "cookietest", email: "cookietest@example.com", password: PASSWORD },
    });
    const c = r.setCookies.find((x) => x.startsWith("ifind_token="));
    assert.ok(c, "no session cookie set");
    assert.match(c!, /HttpOnly/i);
    assert.match(c!, /SameSite=lax/i);
    assert.match(c!, /Secure/i);
  });

  it("over-long passwords are rejected before hashing", async () => {
    const r = await call("/api/auth/login", { method: "POST", json: { identifier: "x", password: "a".repeat(5000) } });
    assert.equal(r.status, 400);
  });

  it("responses never contain the password hash or internal login history", async () => {
    const jar = await registerStudent("minimal");
    for (const path of ["/api/auth/me", "/api/user/dashboard"]) {
      const r = await call(path, { jar });
      assert.equal(r.status, 200, `${path}: ${r.text.slice(0, 200)}`);
      assert.equal(/"password"|failedLoginAttempts|\$2[aby]\$/.test(r.text), false, `${path} leaked a sensitive field`);
    }
  });
});

describe("session lifecycle and password policy", () => {
  /** A cookie lifted before logout/password change (what a thief holds). */
  const copyOf = (jar: Jar): Jar => ({ ...jar });
  /** Revocation is read through a 15-second cache on student sessions, so allow for it; employers and moderators are immediate. */
  async function statusEventually(path: string, jar: Jar, want: number, budgetMs = 20_000) {
    const end = Date.now() + budgetMs;
    let status = 0;
    do {
      status = (await call(path, { jar })).status;
      if (status === want) return status;
      await new Promise((r) => setTimeout(r, 1000));
    } while (Date.now() < end);
    return status;
  }

  it("student logout invalidates a copied session token", async () => {
    const jar = await registerStudent("logoutuser");
    const stolen = copyOf(jar);
    assert.equal((await call("/api/auth/me", { jar: stolen })).status, 200);
    assert.equal((await call("/api/auth/logout", { method: "POST", jar })).status, 200);
    assert.equal(await statusEventually("/api/auth/me", copyOf(stolen), 401), 401, "copied token still works after logout");
  });

  it("employer password change and logout invalidate older tokens; the changing browser keeps working", async () => {
    const jar: Jar = {};
    const reg = await call("/api/employer/auth/register", { method: "POST", jar, json: { name: "Emp Two", email: "emp2@example.com", password: PASSWORD } });
    assert.equal(reg.status, 201, reg.text);
    const stolen = copyOf(jar);
    const change = await call("/api/employer/account/password", { method: "POST", jar, json: { currentPassword: PASSWORD, newPassword: "BrandNewPassw0rd" } });
    assert.equal(change.status, 200, change.text);
    assert.equal((await call("/api/employer/profile", { jar: stolen })).status, 401, "token from before the password change still works");
    assert.equal((await call("/api/employer/profile", { jar })).status, 200, "the browser that changed the password was logged out");

    const copy = copyOf(jar);
    assert.equal((await call("/api/employer/auth/logout", { method: "POST", jar })).status, 200);
    assert.equal((await call("/api/employer/profile", { jar: copy })).status, 401, "copied employer token works after logout");
  });

  it("a moderator who is banned or un-verified loses access even though the 24h token is still valid", async () => {
    const email = "mod2@example.com";
    const reg = await call("/api/moderator/auth/register", { method: "POST", json: { name: "Mod Two", email, password: PASSWORD } });
    assert.equal(reg.status, 201, reg.text);
    const mods = mongoose.connection.collection("moderators");
    await mods.updateOne({ email }, { $set: { isVerified: true } });
    const jar: Jar = {};
    const login = await call("/api/moderator/auth/login", { method: "POST", jar, json: { email, password: PASSWORD } });
    assert.equal(login.status, 200, login.text);
    assert.equal((await call("/api/moderator/users", { jar })).status, 200);

    await mods.updateOne({ email }, { $set: { isBanned: true } });
    const banned = await call("/api/moderator/users", { jar });
    assert.ok(banned.status === 401 || banned.status === 403, `banned moderator kept access (${banned.status})`);
    assert.equal((await call("/api/admin/refresh-recommendations", { method: "POST", jar })).status, 401);

    await mods.updateOne({ email }, { $set: { isBanned: false, isVerified: false } });
    const r = await call("/api/moderator/users", { jar });
    assert.ok(r.status === 401 || r.status === 403, `un-verified moderator got ${r.status}`);

    await mods.updateOne({ email }, { $set: { isVerified: true } });
    const copy = copyOf(jar);
    assert.equal((await call("/api/moderator/auth/logout", { method: "POST", jar })).status, 200);
    const after = await call("/api/moderator/users", { jar: copy });
    assert.ok(after.status === 401 || after.status === 403, `copied moderator token works after logout (${after.status})`);
  });

  it("new passwords are screened: common, containing the username or email, and the old policy", async () => {
    const bad = async (password: string, extra: Record<string, string> = {}) =>
      call("/api/auth/register", {
        method: "POST",
        headers: { "x-forwarded-for": `10.1.0.${nextIp++}` },
        json: { name: "Policy Test", username: "policyuser", email: "policyuser@example.com", password, ...extra },
      });
    assert.equal((await bad("Password1")).status, 400);
    assert.equal((await bad("Welcome123")).status, 400);
    assert.equal((await bad("Policyuser99X")).status, 400); // contains the username
    assert.equal((await bad("short1A")).status, 400);
    assert.equal((await bad("nouppercase123")).status, 400);
    const emp = await call("/api/employer/auth/register", { method: "POST", headers: { "x-forwarded-for": `10.1.0.${nextIp++}` }, json: { name: "Emp", email: "emppolicy@example.com", password: "Qwerty123" } });
    assert.equal(emp.status, 400);
    assert.equal((await bad("Xk9mQ2vLp8Rt")).status, 201);
  });
});

describe("MongoDB access control", () => {
  const oid = (v: string) => new mongoose.Types.ObjectId(v);
  const idOf = async (jar: Jar) => String((await call("/api/auth/me", { jar })).data?.data && ((await call("/api/auth/me", { jar })).data?.data as { _id: string })._id);

  it("internship-match rejects operator objects and other users' job descriptions", async () => {
    const a = await registerStudent("jdowner");
    const b = await registerStudent("jdthief");
    const aId = await idOf(a);
    const inserted = await mongoose.connection.collection("jobdescriptions").insertOne({
      userId: oid(aId), title: "Secret role", company: "Acme", description: "confidential text", createdAt: new Date(), updatedAt: new Date(),
    });
    const jdId = String(inserted.insertedId);

    // {"$gt": ""} used to match the first job description of ANY user
    const inj = await call("/api/internship-match", { method: "POST", jar: b, json: { resumeId: "r1", jobDescriptionId: { $gt: "" } } });
    assert.equal(inj.status, 400, inj.text);
    const arr = await call("/api/internship-match", { method: "POST", jar: b, json: { resumeId: "r1", jobDescriptionId: [jdId] } });
    assert.equal(arr.status, 400, arr.text);
    // a real id that belongs to someone else
    const idor = await call("/api/internship-match", { method: "POST", jar: b, json: { resumeId: "r1", jobDescriptionId: jdId } });
    assert.equal(idor.status, 404, idor.text);
    assert.equal(/confidential text|Secret role/.test(idor.text), false);

    // an old match row pointing at someone else's job description must not populate it
    await mongoose.connection.collection("jobmatches").insertOne({ userId: oid(await idOf(b)), resumeId: "r1", jobDescriptionId: inserted.insertedId, overallScore: 1, createdAt: new Date() });
    const list = await call("/api/internship-match", { jar: b });
    assert.equal(list.status, 200, list.text);
    assert.equal(/confidential text|Secret role/.test(list.text), false, "foreign job description was populated");
  });

  it("profile and dashboard responses never include password hash, login history or session version", async () => {
    const jar = await registerStudent("nosecrets");
    const put = await call("/api/user/profile", { method: "PUT", jar, json: { userUpdate: { city: "Mumbai" } } });
    assert.equal(put.status, 200, put.text);
    for (const [name, text] of [["PUT /api/user/profile", put.text], ["GET /api/auth/me", (await call("/api/auth/me", { jar })).text], ["GET /api/user/dashboard", (await call("/api/user/dashboard", { jar })).text]]) {
      assert.equal(/"password"|\$2[aby]\$|failedLoginAttempts|tokenVersion/.test(text), false, `${name} leaked a secret field`);
    }
  });

  it("a student cannot write role, ban, credit, session or identity-bypass fields through the profile API", async () => {
    const jar = await registerStudent("escalator");
    const id = await idOf(jar);
    const users = mongoose.connection.collection("users");
    const before = await users.findOne({ _id: oid(id) });
    const r = await call("/api/user/profile", {
      method: "PUT", jar,
      json: { userUpdate: { city: "Delhi", role: "moderator", isBanned: false, dailyCreditLimit: 999999, tokenVersion: 99, password: "x", _id: "000000000000000000000000", linkedinId: "li-evil", "resume.parsedData": {}, $set: { role: "moderator" } } },
    });
    assert.ok(r.status === 200 || r.status === 400, r.text);
    const after = await users.findOne({ _id: oid(id) });
    for (const f of ["role", "isBanned", "dailyCreditLimit", "tokenVersion", "password", "linkedinId", "email", "username"]) {
      assert.deepEqual(after?.[f], before?.[f], `${f} was changed by a student`);
    }
    assert.equal(String(after?._id), id);
  });

  it("a student cannot mark another student's notifications read", async () => {
    const a = await registerStudent("notifa");
    const b = await registerStudent("notifb");
    const bId = await idOf(b);
    const n = await mongoose.connection.collection("notifications.student").insertOne({
      recipientType: "student", recipientId: oid(bId), type: "application_status", title: "private", body: "b only", readAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const r = await call("/api/user/notifications", { method: "PATCH", jar: a, json: { id: String(n.insertedId) } });
    assert.ok(r.status === 200 || r.status === 404, r.text);
    assert.equal((await mongoose.connection.collection("notifications.student").findOne({ _id: n.insertedId }))?.readAt, null);
    assert.equal((await call("/api/user/notifications", { jar: a })).text.includes("private"), false);
  });

  it("an employer cannot read or change another company's data", async () => {
    const reg = async (email: string) => {
      const jar: Jar = {};
      const r = await call("/api/employer/auth/register", { method: "POST", jar, headers: { "x-forwarded-for": `10.1.0.${nextIp++}` }, json: { name: "Tenant", email, password: PASSWORD } });
      assert.equal(r.status, 201, r.text);
      return { jar, id: String((r.data?.data as { employerId: string }).employerId) };
    };
    const one = await reg("tenant1@example.com");
    const two = await reg("tenant2@example.com");
    const company = await mongoose.connection.collection("companies").insertOne({
      name: "Tenant One Ltd", slug: "tenant-one-ltd", isActive: true, deleteDetails: { deleted: false, deletedAt: null },
      createdBy: oid(one.id), members: [{ employerId: oid(one.id), role: "owner", addedBy: oid(one.id), addedAt: new Date() }], createdAt: new Date(), updatedAt: new Date(),
    });
    const cid = String(company.insertedId);
    assert.equal((await call(`/api/employer/companies/${cid}`, { jar: one.jar })).status, 200);

    const denied = async (label: string, r: { status: number }) => assert.ok(r.status === 403 || r.status === 404, `${label} -> ${r.status}`);
    await denied("GET company", await call(`/api/employer/companies/${cid}`, { jar: two.jar }));
    await denied("GET members", await call(`/api/employer/companies/${cid}/members`, { jar: two.jar }));
    await denied("GET internships", await call(`/api/employer/companies/${cid}/internships`, { jar: two.jar }));
    await denied("GET applications", await call(`/api/employer/companies/${cid}/applications`, { jar: two.jar }));
    await denied("PATCH company", await call(`/api/employer/companies/${cid}`, { method: "PATCH", jar: two.jar, json: { name: "Hijacked" } }));
    await denied("POST members (add self)", await call(`/api/employer/companies/${cid}/members`, { method: "POST", jar: two.jar, json: { email: "tenant2@example.com", role: "owner" } }));
    await denied("DELETE company", await call(`/api/employer/companies/${cid}`, { method: "DELETE", jar: two.jar }));
    const doc = await mongoose.connection.collection("companies").findOne({ _id: company.insertedId });
    assert.equal(doc?.name, "Tenant One Ltd");
    assert.equal(doc?.members.length, 1);
  });
});

describe("hostile input reaches no dangerous sink", () => {
  it("career-assistant and chat routes reject wrong types and oversized text before any model call", async () => {
    const jar = await registerStudent("promptabuse");
    const post = (path: string, json: unknown) => call(path, { method: "POST", jar, json });
    assert.equal((await post("/api/career-assistant/interview", { jobRole: { $ne: 1 } })).status, 400);
    assert.equal((await post("/api/career-assistant/interview", { jobRole: ["a"] })).status, 400);
    assert.equal((await post("/api/career-assistant/career-roadmap", { currentRole: "x".repeat(500), targetRole: "y" })).status, 400);
    assert.equal((await post("/api/career-assistant/learning-roadmap", { targetSkills: "not-a-list" })).status, 400);
    assert.equal((await post("/api/career-assistant/learning-roadmap", { targetSkills: Array(500).fill("js") })).status, 400);
    assert.equal((await post("/api/career-assistant/rewrite", { content: "z".repeat(6000) })).status, 400);
    assert.equal((await post("/api/career-assistant/star", { experience: { toString: "x" } })).status, 400);
    assert.equal((await post("/api/career-assistant/projects", { targetRole: 12345 })).status, 400);
    assert.equal((await post("/api/chat/sessions", { resumeId: { $gt: "" } })).status, 400);
    assert.equal((await post("/api/chat/sessions", { resumeId: "r", title: { a: 1 } })).status < 500, true);
  });

  it("oversized request bodies are refused before parsing", async () => {
    const jar = await registerStudent("bigbody");
    const big = JSON.stringify({ resumeId: "r", title: "t", pad: "a".repeat(3 * 1024 * 1024) });
    const r = await call("/api/chat/sessions", { method: "POST", jar, headers: { "content-type": "application/json" }, body: big });
    assert.equal(r.status, 413, `${r.status} ${r.text.slice(0, 120)}`);
    const up = new FormData();
    up.append("file", new Blob([new Uint8Array(7 * 1024 * 1024)], { type: "image/png" }), "x.png");
    assert.equal((await call("/api/user/upload-picture", { method: "POST", jar, body: up })).status, 413);
  });

  it("a moderator search is matched literally: invalid or catastrophic patterns neither error nor hang", async () => {
    const email = "mod3@example.com";
    assert.equal((await call("/api/moderator/auth/register", { method: "POST", json: { name: "Mod Three", email, password: PASSWORD } })).status, 201);
    await mongoose.connection.collection("moderators").updateOne({ email }, { $set: { isVerified: true } });
    const jar: Jar = {};
    assert.equal((await call("/api/moderator/auth/login", { method: "POST", jar, json: { email, password: PASSWORD } })).status, 200);
    for (const q of ["[", "(a+)+$", "(", "*", ".*", "\\"]) {
      const t0 = Date.now();
      const r = await call(`/api/moderator/users?search=${encodeURIComponent(q)}`, { jar });
      assert.equal(r.status, 200, `search ${JSON.stringify(q)} -> ${r.status} ${r.text.slice(0, 100)}`);
      assert.ok(Date.now() - t0 < 3000, `search ${JSON.stringify(q)} was slow`);
    }
  });

  it("upload filenames and declared types are never used: traversal names are accepted only as inert metadata", async () => {
    const jar = await registerStudent("traversal");
    const form = new FormData();
    form.append("resume", new Blob([new Uint8Array(Buffer.from("MZ\x90\x00 this is an executable"))], { type: "application/pdf" }), "../../../etc/passwd.pdf");
    const r = await call("/api/user/resume/upload-temp", { method: "POST", jar, body: form });
    assert.equal(r.status, 400, r.text); // content is not a PDF, whatever the name or declared type says
    const exe = new FormData();
    exe.append("file", new Blob([new Uint8Array(Buffer.from("MZ\x90\x00"))], { type: "image/png" }), "..\..\evil.exe");
    assert.equal((await call("/api/user/upload-picture", { method: "POST", jar, body: exe })).status, 400);
  });
});

describe("cost and resource controls", () => {
  it("creating chat sessions is rate limited per user (429 + Retry-After) and the list is bounded", async () => {
    const jar = await registerStudent("sessionspam");
    const statuses: number[] = [];
    let last: Awaited<ReturnType<typeof call>> | undefined;
    for (let i = 0; i < 32; i++) {
      last = await call("/api/chat/sessions", { method: "POST", jar, json: { resumeId: "r", title: `t${i}` } });
      statuses.push(last.status);
    }
    assert.equal(statuses.slice(0, 30).every((x) => x === 200 || x === 201), true, statuses.join());
    assert.equal(statuses[30], 429);
    assert.ok(last?.headers.get("retry-after"));
    const list = await call("/api/chat/sessions", { jar });
    assert.equal(list.status, 200);
    assert.ok(((list.data?.data as unknown[]) ?? []).length <= 200);
  });

  it("profile saves (which trigger the vectoriser) are rate limited per user", async () => {
    const jar = await registerStudent("profilespam");
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) statuses.push((await call("/api/user/profile", { method: "PUT", jar, json: { userUpdate: { city: `City${i}` } } })).status);
    assert.equal(statuses.slice(0, 60).every((x) => x === 200), true, statuses.join());
    assert.equal(statuses[60], 429);
  });

  it("the unauthenticated LinkedIn callback is limited per address before it calls LinkedIn", async () => {
    const headers = { "x-forwarded-for": "10.9.9.9" };
    const statuses: number[] = [];
    for (let i = 0; i < 42; i++) statuses.push((await call("/api/auth/linkedin/callback?error=access_denied", { headers })).status);
    assert.equal(statuses.slice(0, 40).every((x) => x === 307 || x === 302), true, statuses.join());
    assert.equal(statuses[40], 429);
  });

  it("every billed AI route refuses a signed-out caller before doing any work", async () => {
    for (const path of [
      "/api/career-assistant/interview", "/api/career-assistant/career-roadmap", "/api/career-assistant/learning-roadmap",
      "/api/career-assistant/projects", "/api/career-assistant/rewrite", "/api/career-assistant/star",
      "/api/chat/messages", "/api/internship-match", "/api/job-descriptions", "/api/user/resume/analyze",
      "/api/user/resume/reextract", "/api/user/resume/upload-temp",
    ]) {
      const r = await call(path, { method: "POST", json: { jobRole: "x", targetRole: "y", currentRole: "z", content: "c", experience: "e", targetSkills: ["a"] } });
      assert.equal(r.status, 401, `${path} -> ${r.status}`);
    }
  });
});

describe("CSRF", () => {
  it("blocks cross-site writes, allows same-origin and server-to-server", async () => {
    const jar = await registerStudent("csrfuser");
    const evil = await call("/api/auth/logout", { method: "POST", jar, headers: { origin: "https://evil.example" } });
    assert.equal(evil.status, 403);
    const sfs = await call("/api/auth/logout", { method: "POST", jar, headers: { "sec-fetch-site": "cross-site" } });
    assert.equal(sfs.status, 403);
    const same = await call("/api/auth/logout", { method: "POST", jar, headers: { origin: BASE } });
    assert.equal(same.status, 200);
    const noOrigin = await call("/api/auth/logout", { method: "POST", jar });
    assert.equal(noOrigin.status, 200);
  });
});

describe("uploads", () => {
  const upload = (jar: Jar, path: string, field: string, bytes: Buffer, type: string, name: string) => {
    const form = new FormData();
    form.append(field, new Blob([new Uint8Array(bytes)], { type }), name);
    return call(path, { method: "POST", jar, body: form });
  };

  it("rejects HTML/SVG disguised as an image, by content not declared type", async () => {
    const jar = await registerStudent("uploader");
    const html = await upload(jar, "/api/user/upload-picture", "file", Buffer.from("<html><script>alert(1)</script></html>"), "image/png", "a.png");
    assert.equal(html.status, 400, html.text);
    const svg = await upload(jar, "/api/user/upload-picture", "file", Buffer.from("<svg onload=alert(1)/>"), "image/svg+xml", "a.svg");
    assert.equal(svg.status, 400, svg.text);
  });

  it("a real PNG passes validation (storage then fails because ImageKit isn't configured here)", async () => {
    const jar = await registerStudent("uploader2");
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
    const r = await upload(jar, "/api/user/upload-picture", "file", png, "image/png", "a.png");
    assert.notEqual(r.status, 400, r.text);
    assert.equal(/imagekit|private key/i.test(r.text), false, "storage error text must not leak: " + r.text);
  });

  it("rejects a non-PDF sent as application/pdf", async () => {
    const jar = await registerStudent("uploader3");
    const r = await upload(jar, "/api/user/resume/upload-temp", "resume", Buffer.from("MZ not a pdf at all"), "application/pdf", "r.pdf");
    assert.equal(r.status, 400, r.text);
  });

  it("rejects oversized images", async () => {
    const jar = await registerStudent("uploader4");
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(6 * 1024 * 1024)]);
    const r = await upload(jar, "/api/user/upload-picture", "file", big, "image/jpeg", "big.jpg");
    assert.ok(r.status === 400 || r.status === 413, r.text); // 413 from the request-size cap, 400 from the route's own check
  });
});

describe("headers and public metadata", () => {
  it("sends the security headers and no framework banner", async () => {
    const r = await call("/user");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.match(r.headers.get("content-security-policy") ?? "", /object-src 'none'/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.match(r.headers.get("strict-transport-security") ?? "", /max-age=\d+/);
    assert.ok(r.headers.get("referrer-policy"));
    assert.equal(r.headers.get("x-powered-by"), null);
  });

  it("authenticated areas are not cacheable and not indexable", async () => {
    const api = await call("/api/auth/me");
    assert.match(api.headers.get("cache-control") ?? "", /no-store/);
    assert.match(api.headers.get("x-robots-tag") ?? "", /noindex/);
    const login = await call("/user/login");
    assert.match(login.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal((await call("/user")).headers.get("x-robots-tag"), null);
  });

  it("robots.txt and sitemap.xml list only public pages", async () => {
    const robots = (await call("/robots.txt")).text;
    assert.match(robots, /Disallow: \/api\//);
    assert.match(robots, /Sitemap: .*\/sitemap\.xml/);
    const sitemap = (await call("/sitemap.xml")).text;
    for (const path of ["/user<", "/employer<", "/faq<"]) assert.ok(sitemap.includes(path), `${path} missing`);
    assert.equal(/login|register|moderator|\/api\//.test(sitemap), false);
  });

  it("unknown routes return a branded 404", async () => {
    const r = await call("/definitely/not/a/page");
    assert.equal(r.status, 404);
    assert.match(r.text, /find that page/);
  });

  it("landing pages have unique title, canonical and og:image", async () => {
    const titles = new Set<string>();
    for (const path of ["/user", "/employer", "/faq"]) {
      const { text } = await call(path);
      const title = text.match(/<title>([^<]*)<\/title>/)?.[1];
      assert.ok(title, `${path} has no title`);
      titles.add(title!);
      assert.match(text, new RegExp(`<link rel="canonical" href="[^"]*${path}"`));
      assert.match(text, /<meta property="og:image" content="[^"]+"/);
      assert.match(text, /<meta name="description" content="[^"]{40,}"/);
    }
    assert.equal(titles.size, 3, "titles must be unique");
  });

  it("the social image is a real PNG", async () => {
    const res = await fetch(`${BASE}/opengraph-image`);
    assert.equal(res.headers.get("content-type"), "image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(1, 4).toString("ascii"), "PNG");
  });

  it("analytics stays off without a measurement id", async () => {
    const { text } = await call("/user");
    assert.equal(/googletagmanager\.com\/gtag/.test(text), false);
  });
});
