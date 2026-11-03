import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { campusPostingBlocked, resolveMembership } from "../lib/campus/access";
import { applyToCampusInternship } from "../lib/campus/apply";
import { createCampusEntity } from "../lib/campus/entities";
import { campusModerationDetail, listCampusesForModeration, moderateCampus } from "../lib/campus/moderation";
import { sendToStudents, type Transport } from "../lib/campus/outbound";
import { enrollmentSchema, joinCampus, reportCampus, saveEnrollment } from "../lib/campus/student";
import { createEvent, eventSchema } from "../lib/campus/events";
import { campusCreateSchema } from "../lib/campus/validation";
import BanEvent from "../models/BanEvent";
import CampusApplication from "../models/CampusApplication";
import CampusEnrollment from "../models/CampusEnrollment";
import CampusEntity from "../models/CampusEntity";
import CampusInternship from "../models/CampusInternship";
import College from "../models/College";
import Employer from "../models/Employer";
import OutboundMessage from "../models/OutboundMessage";
import { StudentNotification } from "../models/Notification";
import User from "../models/User";

const id = () => new mongoose.Types.ObjectId();
const college = id();
const mod = { id: id(), name: "Mod Maya" };
let server: { stop: () => Promise<boolean> } | null = null;
let n = 0;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
    await College.collection.insertOne({ _id: college, name: "Moderated College" });
    await Promise.all([CampusEntity.syncIndexes(), CampusApplication.syncIndexes(), OutboundMessage.syncIndexes()]);
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

const owner = async () => String((await Employer.create({ name: `Owner ${++n}`, email: `owner${n}@x.edu`, password: "x" }))._id);
const entity = async (over: Record<string, unknown> = {}) => {
    const r = await createCampusEntity(new mongoose.Types.ObjectId(await owner()), campusCreateSchema.parse({ name: `Cell ${++n}`, collegeId: String(college), ...over }));
    assert.ok(r.ok);
    if (!r.ok) throw new Error();
    return r.entity;
};
const student = async (e?: { _id: mongoose.Types.ObjectId }) => {
    const name = `m${++n}`;
    const u = await User.create({ name, username: name, email: `${name}@x.edu`, resume: { driveViewLink: "https://cdn/r.pdf" } });
    await saveEnrollment(String(u._id), enrollmentSchema.parse({ collegeId: String(college), course: "B.Tech", department: "CSE", collegeUid: `U${n}`, batch: new Date().getFullYear() + 1 }));
    if (e) assert.ok((await joinCampus(String(u._id), { target: { entityId: String(e._id) }, confirm: true, confirmSwitch: false })).ok);
    return String(u._id);
};
const internship = (e: { _id: mongoose.Types.ObjectId }) => CampusInternship.create({ entityId: e._id, collegeId: college, postedBy: id(), status: "open", company: { name: "Acme" }, designation: "SDE", deadlineDate: new Date(Date.now() + 86_400_000 * 3) });
const reload = (e: { _id: mongoose.Types.ObjectId }) => CampusEntity.findById(e._id).lean();

test("list: most reported first, filters, search escaped", async () => {
    const quiet = await entity(), noisy = await entity({ name: "Noisy Placement Cell" });
    for (let k = 0; k < 3; k++) assert.ok((await reportCampus(await student(), String(noisy._id), { reason: "scam" })).ok);
    const all = await listCampusesForModeration({});
    assert.equal(all.data[0]._id, String(noisy._id));
    assert.equal(all.data[0].reportCount, 3);
    assert.deepEqual((await listCampusesForModeration({ status: "reported" })).data.map((r) => r._id), [String(noisy._id)]);
    assert.equal((await listCampusesForModeration({ search: "noisy" })).total, 1);
    assert.equal((await listCampusesForModeration({ search: "Moderated College" })).total >= 2, true); // by college name
    assert.equal((await listCampusesForModeration({ search: ".*" })).total, 0);
    assert.ok((await listCampusesForModeration({ status: "none" })).data.some((r) => r._id === String(quiet._id)));
    assert.equal(all.data[0].creator.startsWith("Owner"), true);
});

test("detail shows who reported and why (moderators only data)", async () => {
    const e = await entity();
    const s = await student();
    await reportCampus(s, String(e._id), { reason: "wrong_college", note: "That is a different college" });
    const d = await campusModerationDetail(String(e._id));
    assert.equal(d!.reports.length, 1);
    assert.equal(d!.reports[0].reason, "wrong_college");
    assert.match(d!.reports[0].student, /^m\d+$/);
    assert.equal(d!.members.length, 1);
    assert.equal(await campusModerationDetail("nope"), null);
});

test("restrict: needs a reason, conditional, recorded; blocks posting, joins, applying and all outbound mail", async () => {
    const e = await entity();
    const i = await internship(e);
    const joined = await student(e), outsider = await student();
    assert.ok((await applyToCampusInternship(joined, String(i._id), { answers: [], confirm: true })).ok);

    const noReason = await moderateCampus(String(e._id), "restrict", "  ", mod);
    assert.ok(!noReason.ok && noReason.code === "reason_required");
    assert.ok(!(await moderateCampus(String(e._id), "lift", "", mod)).ok); // not restricted yet
    const r = await moderateCampus(String(e._id), "restrict", "Unverified placement cell", mod);
    assert.ok(r.ok && r.status === "restricted" && r.studentsDetached === 0);
    const doc = await reload(e);
    assert.deepEqual([doc!.restriction.status, doc!.restriction.reason], ["restricted", "Unverified placement cell"]);
    assert.ok(!(await moderateCampus(String(e._id), "restrict", "again", mod)).ok); // no change
    assert.equal(await BanEvent.countDocuments({ userId: e._id, targetType: "campus" }), 1);

    // posting
    const blocked = campusPostingBlocked({ restriction: doc!.restriction } as never);
    assert.equal(blocked?.status, 403);
    assert.equal(campusPostingBlocked({ restriction: { status: "none" } } as never), null);
    // joins
    const join = await joinCampus(outsider, { target: { entityId: String(e._id) }, confirm: true, confirmSwitch: false });
    assert.ok(!join.ok && join.code === "restricted");
    // applying
    // outbound: nothing is emailed from a restricted campus, but the in-app notice still goes
    const sent: string[] = [];
    const transport: Transport = { email: async (m) => { sent.push(m.to); return { ok: true }; }, sms: async () => ({ ok: true }) };
    const before = await OutboundMessage.countDocuments({});
    const counts = await sendToStudents([{ id: joined, email: "a@x.edu", emailUpdates: true, smsUpdates: false }], () => ({ subject: "s", text: "t" }), { email: true, kind: "test", refId: "R", entityId: String(e._id), transport });
    assert.deepEqual([sent.length, counts.emailed, await OutboundMessage.countDocuments({})], [0, 0, before]);
    const ev = await createEvent(e, eventSchema.parse({ title: "Restricted notice" }), id());
    assert.ok(ev.ok);
    assert.equal(await StudentNotification.countDocuments({ recipientId: joined, title: /Restricted notice/ }), 1); // in-app still delivered
    assert.equal(await OutboundMessage.countDocuments({ refId: ev.ok ? String(ev.event._id) : "", kind: "event" }), 0); // no mail row

    // staff keep access and are told, through the bypass
    assert.equal(resolveMembership(doc as never, doc!.members[0].employerId, "viewer").status, "ok");
    assert.ok(await OutboundMessage.exists({ kind: "campus-restriction", refId: String(e._id) }));

    // lift restores everything
    assert.ok((await moderateCampus(String(e._id), "lift", "", mod)).ok);
    assert.equal((await reload(e))!.restriction.status, "none");
    assert.ok((await joinCampus(outsider, { target: { entityId: String(e._id) }, confirm: true, confirmSwitch: false })).ok);
    assert.equal(campusPostingBlocked({ restriction: (await reload(e))!.restriction } as never), null);
});

test("applying to a restricted campus is refused", async () => {
    const e = await entity();
    const i = await internship(e);
    const s = await student(e);
    await moderateCampus(String(e._id), "restrict", "Under review", mod);
    const r = await applyToCampusInternship(s, String(i._id), { answers: [], confirm: true });
    assert.ok(!r.ok && r.code === "restricted");
});

test("ban: internships closed, applications withdrawn, students detached and told; staff still see the campus; lift allows a restart", async () => {
    const e = await entity();
    const [i1, i2] = [await internship(e), await internship(e)];
    const [a, b] = [await student(e), await student(e)];
    const app = await applyToCampusInternship(a, String(i1._id), { answers: [], confirm: true });
    assert.ok(app.ok);

    const res = await moderateCampus(String(e._id), "ban", "Fake placement cell", mod);
    assert.ok(res.ok && res.status === "banned" && res.studentsDetached === 2);
    const doc = await reload(e);
    assert.equal(doc!.isActive, true); // visible to staff so they can read why
    assert.equal(doc!.restriction.status, "banned");
    assert.equal(resolveMembership(doc as never, doc!.members[0].employerId, "viewer").status, "ok");
    for (const i of [i1, i2]) assert.equal((await CampusInternship.findById(i._id).lean())!.status, "closed");
    assert.equal((await CampusApplication.findById(app.ok ? app.applicationId : "").lean())!.status, "withdrawn");
    assert.equal(await CampusEnrollment.countDocuments({ entityId: e._id }), 0);
    for (const s of [a, b]) assert.equal(await StudentNotification.countDocuments({ recipientId: s, type: "campus_entity_closed" }), 1);
    assert.ok(!(await moderateCampus(String(e._id), "ban", "twice", mod)).ok);
    assert.ok(!(await joinCampus(await student(), { target: { entityId: String(e._id) }, confirm: true, confirmSwitch: false })).ok);

    // banned students are free to join another campus right away
    const other = await entity();
    assert.ok((await joinCampus(a, { target: { entityId: String(other._id) }, confirm: true, confirmSwitch: false })).ok);

    assert.ok((await moderateCampus(String(e._id), "lift", "", mod)).ok);
    const history = await BanEvent.find({ userId: e._id, targetType: "campus" }).sort({ at: 1 }).lean();
    assert.deepEqual(history.map((h) => h.action), ["ban", "unban"]);
    assert.match(history[0].reason!, /^\[banned\] Fake placement cell/);
});

test("two moderators acting at once: exactly one transition wins", async () => {
    const e = await entity();
    const [x, y] = await Promise.all([moderateCampus(String(e._id), "restrict", "A", mod), moderateCampus(String(e._id), "ban", "B", mod)]);
    assert.equal([x, y].filter((r) => r.ok).length, 1);
});

test("a campus deleted by its owner cannot be moderated; unknown ids are 404", async () => {
    const e = await entity();
    await CampusEntity.updateOne({ _id: e._id }, { $set: { isActive: false, "deleteDetails.deleted": true } });
    const r = await moderateCampus(String(e._id), "restrict", "x", mod);
    assert.ok(!r.ok && r.code === "deleted");
    const missing = await moderateCampus(String(id()), "restrict", "x", mod);
    assert.ok(!missing.ok && missing.status === 404);
    assert.ok(!(await moderateCampus("nope", "lift", "", mod)).ok);
});
