import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { withdrawCampusApplication } from "../lib/campus/applications";
import { closeCampusEntity } from "../lib/campus/deletion";
import { announceEntityCreated, createCampusEntity } from "../lib/campus/entities";
import { campusState, enrollmentSchema, getEnrollment, joinCampus, leaveCampus, lookupByCode, reportCampus, retractReport, saveEnrollment, type JoinInput } from "../lib/campus/student";
import { listCampusStudents } from "../lib/campus/students";
import { campusCreateSchema } from "../lib/campus/validation";
import CampusApplication from "../models/CampusApplication";
import CampusBlacklist from "../models/CampusBlacklist";
import CampusEnrollment from "../models/CampusEnrollment";
import CampusEntity from "../models/CampusEntity";
import CampusInternship from "../models/CampusInternship";
import College from "../models/College";
import CollegeNotification from "../models/CollegeNotification";
import { StudentNotification } from "../models/Notification";
import User from "../models/User";
import type { CampusApplicationStatus } from "../types/campus";

const id = () => new mongoose.Types.ObjectId();
const collegeA = id(), collegeB = id();
let server: { stop: () => Promise<boolean> } | null = null;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
    await College.collection.insertMany([{ _id: collegeA, name: "College A" }, { _id: collegeB, name: "College B" }]);
    await CampusEntity.syncIndexes();
    await CampusBlacklist.syncIndexes();
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

let n = 0;
const student = async (name = `stu${++n}`) => String((await User.create({ name, username: name, email: `${name}@x.edu` }))._id);
const details = (college: mongoose.Types.ObjectId, uid = `UID${++n}`) =>
    enrollmentSchema.parse({ collegeId: String(college), course: "B.Tech", department: "CSE", collegeUid: uid, batch: new Date().getFullYear() + 1, cgpa: "8.1" });
const enrolled = async (college = collegeA, uid?: string) => {
    const userId = await student();
    const r = await saveEnrollment(userId, details(college, uid));
    assert.ok(r.ok);
    return userId;
};
const campus = async (college = collegeA, over: Record<string, unknown> = {}) => {
    const r = await createCampusEntity(id(), campusCreateSchema.parse({ name: `Cell ${++n}`, collegeId: String(college), ...over }));
    assert.ok(r.ok);
    if (!r.ok) throw new Error();
    return r.entity;
};
const join = (userId: string, entityId: string, over: Partial<JoinInput> = {}) =>
    joinCampus(userId, { target: { entityId }, confirm: true, confirmSwitch: false, ...over });
const app = async (userId: string, entityId: mongoose.Types.ObjectId, status: CampusApplicationStatus = "applied") => {
    const intern = await CampusInternship.create({ entityId, collegeId: collegeA, postedBy: id(), status: "open", company: { name: "Acme" }, designation: "SDE" });
    const enr = (await getEnrollment(userId))!;
    return CampusApplication.create({
        entityId, internshipId: intern._id, studentId: userId, enrollmentId: enr._id, status,
        applicantSnapshot: { name: "x", uid: "1", course: "B.Tech", department: "CSE", batch: 2027, email: "x@x.edu" },
    });
};
const count = async (e: mongoose.Types.ObjectId) => (await CampusEntity.findById(e).lean())!.studentCount;

test("enrollment: validates, saves with no campus, duplicate college IDs allowed, college change blocked while joined", async () => {
    assert.equal(enrollmentSchema.safeParse({ collegeId: String(collegeA), course: "", department: "x", collegeUid: "1", batch: 2027 }).success, false);
    assert.equal(enrollmentSchema.safeParse({ ...details(collegeA), cgpa: 101 }).success, false);
    const a = await student(), b = await student();
    const ra = await saveEnrollment(a, details(collegeA, "SAME-ID"));
    const rb = await saveEnrollment(b, details(collegeA, "SAME-ID"));
    assert.ok(ra.ok && rb.ok);
    if (ra.ok) assert.equal(ra.enrollment.entityId, null);
    assert.equal(await CampusEnrollment.countDocuments({ collegeUid: "SAME-ID" }), 2);
    assert.equal((await saveEnrollment(a, { ...details(collegeA, "SAME-ID"), cgpa: 9 }) as { ok: true; enrollment: { cgpa: number } }).enrollment.cgpa, 9);
    assert.equal(await CampusEnrollment.countDocuments({ userId: a }), 1); // one per student
    assert.equal((await saveEnrollment(a, details(id(), "X")) as { ok: false }).ok, false); // unknown college
    const e = await campus();
    await join(a, String(e._id));
    const blocked = await saveEnrollment(a, details(collegeB));
    assert.ok(!blocked.ok && blocked.code === "college_change_blocked");
});

test("banners: no campus exists -> no_entity; campuses exist -> not_joined; joined -> none", async () => {
    const lonely = id();
    await College.collection.insertOne({ _id: lonely, name: "Lonely" });
    const u = await student();
    await saveEnrollment(u, details(lonely));
    assert.equal((await campusState(u)).banner, "no_entity");
    const e = await campus(lonely);
    assert.equal((await campusState(u)).banner, "not_joined");
    await join(u, String(e._id));
    const s = await campusState(u);
    assert.equal(s.banner, "none");
    assert.equal(s.current?._id, String(e._id));
    assert.equal((await campusState(await student())).enrollment, null);
});

test("first join: needs details, needs confirm, sets the campus and the count", async () => {
    const e = await campus();
    const noDetails = await student();
    assert.equal(((await join(noDetails, String(e._id))) as { code: string }).code, "no_enrollment");
    const u = await enrolled();
    const unconfirmed = await join(u, String(e._id), { confirm: false });
    assert.ok(!unconfirmed.ok && unconfirmed.code === "confirm_required");
    assert.match((unconfirmed as { error: string }).error, /official campus of your college/);
    assert.equal((await getEnrollment(u))!.entityId, null);
    const ok = await join(u, String(e._id));
    assert.ok(ok.ok && !ok.switched);
    assert.equal(String((await getEnrollment(u))!.entityId), String(e._id));
    assert.equal(await count(e._id), 1);
    assert.ok((await join(u, String(e._id))).ok); // idempotent
    assert.equal(await count(e._id), 1);
});

test("join rules: other college, restricted, code-only, bad code", async () => {
    const u = await enrolled(collegeA);
    const other = await campus(collegeB);
    assert.equal(((await join(u, String(other._id))) as { code: string }).code, "wrong_college");
    const restricted = await campus(collegeA);
    await CampusEntity.updateOne({ _id: restricted._id }, { $set: { "restriction.status": "restricted" } });
    assert.equal(((await join(u, String(restricted._id))) as { code: string }).code, "restricted");
    const codeOnly = await campus(collegeA, { listing: "code_only" });
    assert.equal(((await join(u, String(codeOnly._id))) as { code: string }).code, "not_found"); // not joinable by id
    const bad = await joinCampus(u, { target: { code: "ZZZZZZZZ" }, confirm: true, confirmSwitch: false });
    assert.ok(!bad.ok && bad.code === "invalid_code");
    assert.ok(!(await joinCampus(u, { target: { code: "short" }, confirm: true, confirmSwitch: false })).ok);
    const viaCode = await joinCampus(u, { target: { code: codeOnly.joinCode.toLowerCase() }, confirm: true, confirmSwitch: false });
    assert.ok(viaCode.ok);
    // code of a campus of another college is refused
    const u2 = await enrolled(collegeA);
    const wrong = await joinCampus(u2, { target: { code: other.joinCode }, confirm: true, confirmSwitch: false });
    assert.ok(!wrong.ok && wrong.code === "wrong_college");
});

test("lookup by code shows the campus without leaking the code", async () => {
    const u = await enrolled();
    const e = await campus();
    const r = await lookupByCode(u, e.joinCode);
    assert.ok(r.ok);
    if (r.ok) {
        assert.equal(r.campus._id, String(e._id));
        assert.ok(!JSON.stringify(r.campus).includes(e.joinCode));
    }
    assert.ok(!(await lookupByCode(u, "ABCDEFGH")).ok);
});

test("switching: needs the red-panel confirmation; blocked by active applications; works after withdrawing; counts and staff notice move", async () => {
    const e1 = await campus(), e2 = await campus();
    const u = await enrolled();
    await join(u, String(e1._id));
    const first = await join(u, String(e2._id));
    assert.ok(!first.ok && first.code === "already_joined" && first.status === 409);
    assert.equal(String((await getEnrollment(u))!.entityId), String(e1._id));

    const a = await app(u, e1._id, "shortlisted");
    const blocked = await join(u, String(e2._id), { confirmSwitch: true });
    assert.ok(!blocked.ok && blocked.code === "has_active_applications");
    assert.equal(((blocked as { extra: { applications: unknown[] } | undefined }).extra!.applications).length, 1);
    assert.equal(String((await getEnrollment(u))!.entityId), String(e1._id));
    const leaveBlocked = await leaveCampus(u, true);
    assert.ok(!leaveBlocked.ok && leaveBlocked.code === "has_active_applications");

    const w = await withdrawCampusApplication(u, String(a._id), false);
    assert.ok(w.ok);
    const switched = await join(u, String(e2._id), { confirmSwitch: true });
    assert.ok(switched.ok && switched.switched);
    assert.equal(String((await getEnrollment(u))!.entityId), String(e2._id));
    assert.deepEqual([await count(e1._id), await count(e2._id)], [0, 1]);
    assert.ok(await CollegeNotification.exists({ entityId: e1._id, type: "campus_student_left" }));
    assert.equal((await CampusApplication.findById(a._id).lean())!.status, "withdrawn"); // old record stays
});

test("final statuses do not block leaving", async () => {
    const e = await campus();
    const u = await enrolled();
    await join(u, String(e._id));
    for (const s of ["rejected", "declined", "withdrawn", "removed"] as const) await app(u, e._id, s);
    assert.ok((await leaveCampus(u, false)).ok === false); // confirm needed
    const left = await leaveCampus(u, true);
    assert.ok(left.ok);
    assert.equal((await getEnrollment(u))!.entityId, null);
    assert.equal(await count(e._id), 0);
    assert.ok((await leaveCampus(u, true)).ok); // nothing to leave
});

test("a deleted campus never traps a student: applications were withdrawn, leaving works", async () => {
    const e = await campus();
    const u = await enrolled();
    await join(u, String(e._id));
    await app(u, e._id, "offered");
    await closeCampusEntity(e, "deleted");
    assert.equal((await getEnrollment(u))!.entityId, null); // detached already
    const other = await campus();
    assert.ok((await join(u, String(other._id))).ok);
});

test("an active blacklist entry does not stop joining", async () => {
    const e = await campus();
    const u = await enrolled();
    await CampusBlacklist.create({ entityId: e._id, studentId: u, reason: "x", bannedBy: id() });
    assert.ok((await join(u, String(e._id))).ok);
});

test("reports: one per student, reason can change, retract, same college only, count follows the rows", async () => {
    const e = await campus();
    const a = await enrolled(), b = await enrolled(), outsider = await enrolled(collegeB);
    const r1 = await reportCampus(a, String(e._id), { reason: "not_official" });
    assert.ok(r1.ok && r1.reportCount === 1);
    assert.ok((await reportCampus(a, String(e._id), { reason: "scam", note: "fake" })).ok);
    assert.equal((await CampusEntity.findById(e._id).lean())!.reportCount, 1); // same student again: still 1
    const r2 = await reportCampus(b, String(e._id), { reason: "wrong_college" });
    assert.ok(r2.ok && r2.reportCount === 2);
    assert.ok(!(await reportCampus(outsider, String(e._id), { reason: "scam" })).ok);
    const back = await retractReport(a, String(e._id));
    assert.ok(back.ok && back.reportCount === 1);
    const again = await retractReport(a, String(e._id));
    assert.ok(again.ok && again.reportCount === 1); // retracting twice does not go below the real number
    assert.ok(await CollegeNotification.exists({ entityId: e._id, type: "campus_entity_reported" }));
});

test("withdraw: only your own, accepted needs the extra confirmation, final cannot be withdrawn", async () => {
    const e = await campus();
    const u = await enrolled(), other = await enrolled();
    await join(u, String(e._id));
    const acc = await app(u, e._id, "accepted");
    assert.ok(!(await withdrawCampusApplication(other, String(acc._id), true)).ok); // not theirs
    const need = await withdrawCampusApplication(u, String(acc._id), false);
    assert.ok(!need.ok && need.code === "confirm_accepted");
    assert.equal((await CampusApplication.findById(acc._id).lean())!.status, "accepted");
    assert.ok((await withdrawCampusApplication(u, String(acc._id), true)).ok);
    const hist = (await CampusApplication.findById(acc._id).lean())!.statusHistory.at(-1)!;
    assert.deepEqual([hist.status, hist.byStudent], ["withdrawn", true]);
    const again = await withdrawCampusApplication(u, String(acc._id), true);
    assert.ok(!again.ok && again.code === "already_final");
    assert.ok(await CollegeNotification.exists({ entityId: e._id, type: "campus_withdrawal" }));
});

test("new campus announced in-app to every student of that college, listed campuses only", async () => {
    const col = id();
    await College.collection.insertOne({ _id: col, name: "Announce U" });
    const s1 = await enrolled(col), s2 = await enrolled(col), elsewhere = await enrolled(collegeB);
    const existing = await campus(col);
    await join(s2, String(existing._id)); // already in another campus: still told
    const fresh = await campus(col);
    assert.equal(await announceEntityCreated(fresh), 2);
    for (const s of [s1, s2]) assert.equal(await StudentNotification.countDocuments({ recipientId: s, type: "campus_entity_created", title: new RegExp(fresh.name) }), 1);
    assert.equal(await StudentNotification.countDocuments({ recipientId: elsewhere, type: "campus_entity_created" }), 0);
    const hidden = await campus(col, { listing: "code_only" });
    assert.equal(await announceEntityCreated(hidden), 0);
    const note = await StudentNotification.findOne({ recipientId: s1, type: "campus_entity_created" }).lean();
    assert.match(note!.link!, /^\/user\/stu\d+\/campus\/campuses$/);
});

test("staff students list: only this campus, search, duplicate-ID badge", async () => {
    const e1 = await campus(), e2 = await campus();
    const a = await enrolled(collegeA, "DUP-1"), b = await enrolled(collegeA, "DUP-1"), c = await enrolled(collegeA, "UNIQ-9"), z = await enrolled(collegeA, "OTHER-CAMPUS");
    for (const [u, e] of [[a, e1], [b, e1], [c, e1], [z, e2]] as const) await join(u, String(e._id));
    const all = await listCampusStudents(e1._id);
    assert.equal(all.total, 3);
    assert.ok(!all.items.some((i) => i.collegeUid === "OTHER-CAMPUS"));
    assert.deepEqual(all.items.filter((i) => i.duplicateUid).map((i) => i.collegeUid), ["DUP-1", "DUP-1"]);
    assert.equal(all.items.find((i) => i.collegeUid === "UNIQ-9")!.duplicateUid, false);
    assert.equal((await listCampusStudents(e1._id, { q: "uniq" })).total, 1);
    assert.equal((await listCampusStudents(e1._id, { q: ".*" })).total, 0); // regex is escaped
    assert.equal((await listCampusStudents(e1._id, { q: String(new Date().getFullYear() + 1) })).total, 3); // batch year
    assert.equal((await listCampusStudents(e2._id)).total, 1);
});
