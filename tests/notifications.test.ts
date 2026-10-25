import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

/** Company notifications: one document per event, per-member read state, members see only events since they joined. */

let server: { stop: () => Promise<boolean> } | null = null;
let notifyCompany: typeof import("../lib/employer/notify").notifyCompany;
let notify: typeof import("../lib/employer/notify").notify;
let employerFeed: typeof import("../lib/employer/notifications").employerFeed;
let employerUnreadCount: typeof import("../lib/employer/notifications").employerUnreadCount;
let markEmployerRead: typeof import("../lib/employer/notifications").markEmployerRead;
let Company: typeof import("../models/Company").default;
let CompanyNotification: typeof import("../models/Notification").CompanyNotification;
let EmployerNotification: typeof import("../models/Notification").EmployerNotification;

const id = () => new mongoose.Types.ObjectId();
const alice = id(), bob = id(), carol = id(), companyId = id(), otherCompany = id();

before(async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  server = mem;
  await mongoose.connect(mem.getUri());
  ({ notifyCompany, notify } = await import("../lib/employer/notify"));
  ({ employerFeed, employerUnreadCount, markEmployerRead } = await import("../lib/employer/notifications"));
  Company = (await import("../models/Company")).default;
  ({ CompanyNotification, EmployerNotification } = await import("../models/Notification"));

  const base = (name: string, members: { employerId: mongoose.Types.ObjectId; addedAt: Date }[], _id: mongoose.Types.ObjectId) => ({
    _id, name, slug: name.toLowerCase(), description: "x", industry: "Tech", companyType: "startup", size: "1-10", contactEmail: "a@b.co",
    headquarters: { city: "Pune", country: "India" }, createdBy: alice,
    members: members.map((m) => ({ ...m, role: "owner" })),
  });
  // Alice and Bob joined long ago; Carol joins later in the test
  await Company.collection.insertMany([
    base("Acme", [{ employerId: alice, addedAt: new Date("2020-01-01") }, { employerId: bob, addedAt: new Date("2020-01-01") }], companyId),
    base("Other", [{ employerId: carol, addedAt: new Date("2020-01-01") }], otherCompany),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await server?.stop();
});

test("a company event is ONE document but every member sees it", async () => {
  await notifyCompany({ companyId, type: "new_application", title: "New application", link: "/x" });
  assert.equal(await CompanyNotification.countDocuments({ companyId }), 1);
  assert.equal((await employerFeed(alice)).items.length, 1);
  assert.equal((await employerFeed(bob)).items.length, 1);
  assert.equal((await employerFeed(carol)).items.length, 0, "other companies' events stay private");
});

test("reading it clears it only for the reader", async () => {
  const [item] = (await employerFeed(alice)).items;
  assert.equal(item.scope, "company");
  await markEmployerRead(alice, { id: item._id, scope: "company" });
  assert.equal(await employerUnreadCount(alice), 0);
  assert.equal(await employerUnreadCount(bob), 1);
});

test("personal notifications are separate and counted together with the company ones", async () => {
  await notify({ recipientType: "employer", recipientIds: [alice], type: "account_security", title: "Password changed" });
  assert.equal(await EmployerNotification.countDocuments({ recipientId: alice }), 1);
  assert.equal(await employerUnreadCount(alice), 1);
  const feed = await employerFeed(alice);
  assert.deepEqual(feed.items.map((n) => n.scope).sort(), ["company", "personal"]);
  await markEmployerRead(alice, { all: true });
  assert.equal(await employerUnreadCount(alice), 0);
  assert.equal(await employerUnreadCount(bob), 1, "mark-all is per person");
});

test("a member cannot touch another company's notification", async () => {
  await notifyCompany({ companyId: otherCompany, type: "system", title: "Private to Other" });
  const hidden = await CompanyNotification.findOne({ companyId: otherCompany });
  await markEmployerRead(alice, { id: String(hidden!._id), scope: "company" });
  assert.deepEqual((await CompanyNotification.findById(hidden!._id).lean())?.readBy, []);
});

test("a new member does not inherit the company's history", async () => {
  await Company.updateOne({ _id: companyId }, { $push: { members: { employerId: carol, role: "recruiter", addedAt: new Date(Date.now() + 60_000) } } });
  const titles = (await employerFeed(carol)).items.map((n) => n.title);
  assert.ok(!titles.includes("New application"), "events before they joined are hidden");
  assert.ok(titles.includes("Private to Other"), "their own company's events are still shown");
});
