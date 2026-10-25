import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

/** Critical notifications are stored AND emailed through Brevo; normal ones are stored only. */

let server: { stop: () => Promise<boolean> } | null = null;
let notify: typeof import("../lib/employer/notify").notify;
let notifyCompany: typeof import("../lib/employer/notify").notifyCompany;
let EmployerNotification: typeof import("../models/Notification").EmployerNotification;
let CompanyNotification: typeof import("../models/Notification").CompanyNotification;

const realFetch = globalThis.fetch;
let calls: { url: string; headers: Record<string, string>; body: { to: { email: string }[]; subject: string; htmlContent: string } }[] = [];

const id = () => new mongoose.Types.ObjectId();
const alice = id(), bob = id(), companyId = id();

before(async () => {
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "noreply@ifind.test";
  process.env.NEXT_PUBLIC_APP_URL = "https://ifind.test";
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  server = mem;
  await mongoose.connect(mem.getUri());
  ({ notify, notifyCompany } = await import("../lib/employer/notify"));
  ({ EmployerNotification, CompanyNotification } = await import("../models/Notification"));
  await mongoose.connection.collection("employers").insertMany([
    { _id: alice, name: "Alice", email: "alice@acme.test" },
    { _id: bob, name: "Bob", email: "bob@acme.test", isBanned: true },
  ]);
  await mongoose.connection.collection("companies").insertOne({ _id: companyId, name: "Acme", members: [{ employerId: alice }, { employerId: bob }] });
});

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return new Response("{}", { status: 201 });
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await mongoose.disconnect();
  await server?.stop();
});

test("critical personal notification: stored, emailed through Brevo, marked emailed", async () => {
  await notify({ recipientType: "employer", recipientIds: [alice], type: "account_security", title: "Your password was changed", link: "/employer/settings" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(calls[0].headers["api-key"], "test-key");
  assert.deepEqual(calls[0].body.to.map((t) => t.email), ["alice@acme.test"]);
  assert.match(calls[0].body.htmlContent, /https:\/\/ifind\.test\/employer\/settings/);
  const doc = await EmployerNotification.findOne({ recipientId: alice, type: "account_security" }).lean();
  assert.equal(doc?.priority, "critical");
  assert.ok(doc?.emailedAt);
});

test("normal notification: stored only, no email", async () => {
  await notify({ recipientType: "employer", recipientIds: [alice], type: "welcome", title: "Welcome" });
  assert.equal(calls.length, 0);
  const doc = await EmployerNotification.findOne({ type: "welcome" }).lean();
  assert.equal(doc?.priority, "normal");
  assert.equal(doc?.emailedAt ?? null, null);
});

test("priority can be overridden per call", async () => {
  await notify({ recipientType: "employer", recipientIds: [alice], type: "welcome", title: "Urgent welcome", priority: "critical" });
  assert.equal(calls.length, 1);
  await notifyCompany({ companyId, type: "internship_approved", title: "Quiet one", priority: "normal" });
  assert.equal(calls.length, 1, "the override kept it out of email");
});

test("critical company notification: one document, one email to the active members only", async () => {
  await notifyCompany({ companyId, type: "company_restriction", title: "Your company was restricted", body: "Reason: test" });
  assert.equal(await CompanyNotification.countDocuments({ type: "company_restriction" }), 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.to.map((t) => t.email), ["alice@acme.test"], "banned members are skipped");
  assert.match(calls[0].body.subject, /^Acme: /);
});

test("without Brevo configured the notification is still stored", async () => {
  delete process.env.BREVO_API_KEY;
  await notify({ recipientType: "employer", recipientIds: [alice], type: "account_status", title: "Reinstated" });
  assert.equal(calls.length, 0);
  assert.equal(await EmployerNotification.countDocuments({ type: "account_status" }), 1);
  process.env.BREVO_API_KEY = "test-key";
});
