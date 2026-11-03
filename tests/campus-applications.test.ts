import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyToCampusInternship, applySchema, type ApplyInput } from "../lib/campus/apply";
import { buildExport, safeCell, toCsv, toXlsx } from "../lib/campus/export";
import { respondToOffer } from "../lib/campus/offers";
import { addNote, banStudent, bulkChangeStatus, changeCampusStatus, listBlacklist, reinstate, removeFromInternship, removeStudentFromCampus, setRating, setRoundResult, unbanStudent } from "../lib/campus/pipeline";
import { createCampusEntity } from "../lib/campus/entities";
import { listCampusApplicants, campusApplicantDetail } from "../lib/campus/applicants";
import { enrollmentSchema, getEnrollment, joinCampus, saveEnrollment } from "../lib/campus/student";
import { loadCampusApplication, loadCampusApplied } from "../lib/campus/studentApplications";
import { campusCreateSchema } from "../lib/campus/validation";
import { withdrawCampusApplication } from "../lib/campus/applications";
import CampusApplication from "../models/CampusApplication";
import CampusEntity from "../models/CampusEntity";
import CampusBlacklist from "../models/CampusBlacklist";
import CampusInternship from "../models/CampusInternship";
import College from "../models/College";
import OutboundMessage from "../models/OutboundMessage";
import { StudentNotification } from "../models/Notification";
import CollegeNotification from "../models/CollegeNotification";
import User from "../models/User";

const id = () => new mongoose.Types.ObjectId();
const college = id();
const staff = { id: id(), name: "Coordinator Sam" };
let server: { stop: () => Promise<boolean> } | null = null;
let n = 0;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
    await College.collection.insertOne({ _id: college, name: "Apply College" });
    await Promise.all([CampusEntity.syncIndexes(), CampusBlacklist.syncIndexes(), CampusApplication.syncIndexes(), OutboundMessage.syncIndexes()]);
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

const day = 86_400_000;
const entity = async (over: Record<string, unknown> = {}) => {
    const r = await createCampusEntity(id(), campusCreateSchema.parse({ name: `Cell ${++n}`, collegeId: String(college), ...over }));
    assert.ok(r.ok);
    if (!r.ok) throw new Error();
    return r.entity;
};
/** A student with a resume, details and (optionally) joined to the entity. */
const student = async (e?: { _id: mongoose.Types.ObjectId }, details: Record<string, unknown> = {}, resume = true) => {
    const name = `s${++n}`;
    const u = await User.create({ name, username: name, email: `${name}@x.edu`, ...(resume ? { resume: { driveViewLink: "https://cdn/r.pdf" } } : {}) });
    const saved = await saveEnrollment(String(u._id), enrollmentSchema.parse({
        collegeId: String(college), course: "B.Tech", department: "CSE", collegeUid: `UID${n}`, batch: new Date().getFullYear() + 1, cgpa: 8, activeBacklogs: 0, ...details,
    }));
    assert.ok(saved.ok);
    if (e) assert.ok((await joinCampus(String(u._id), { target: { entityId: String(e._id) }, confirm: true, confirmSwitch: false })).ok);
    return String(u._id);
};
const internship = (e: { _id: mongoose.Types.ObjectId }, over: Record<string, unknown> = {}) =>
    CampusInternship.create({ entityId: e._id, collegeId: college, postedBy: id(), status: "open", company: { name: "Acme" }, designation: "SDE", deadlineDate: new Date(Date.now() + day), ...over });
const A: ApplyInput = { answers: [], confirm: true };
const apply = (u: string, i: { _id: mongoose.Types.ObjectId }, over: Partial<ApplyInput> = {}) => applyToCampusInternship(u, String(i._id), { ...A, ...over });
const code = (r: unknown) => (r as { code?: string }).code;

test("apply: blocks, in order, with clear codes", async () => {
    const e = await entity(), other = await entity();
    const i = await internship(e);
    assert.equal(applySchema.safeParse({ answers: [] }).success, false); // must confirm details

    const loner = await student(); // details but no campus
    assert.equal(code(await apply(loner, i)), "not_joined");

    const mine = await student(e);
    assert.equal(code(await applyToCampusInternship(mine, "nope", A)), "not_found");
    const theirs = await internship(other);
    assert.equal(code(await apply(mine, theirs)), "not_found"); // another campus's internship does not exist for me

    const draft = await internship(e, { status: "draft" });
    assert.equal(code(await apply(mine, draft)), "closed");
    const past = await internship(e, { deadlineDate: new Date(Date.now() - 1000) });
    assert.equal(code(await apply(mine, past)), "closed");
    assert.equal((await CampusInternship.findById(past._id).lean())!.status, "closed"); // lazily closed

    const noResume = await student(e, {}, false);
    assert.equal(code(await apply(noResume, await internship(e, { requireResume: true }))), "resume_required");
    assert.ok((await apply(noResume, await internship(e, { requireResume: false }))).ok);

    const picky = await internship(e, { eligibility: { minCgpa: 9 } });
    const inel = await apply(mine, picky);
    assert.equal(code(inel), "ineligible");
    assert.equal(((inel as unknown as { extra: { reasons: string[] } }).extra.reasons).length, 1);

    const withQ = await internship(e, { screeningQuestions: [{ question: "Why us?", type: "text", options: [], required: true }] });
    assert.equal(code(await apply(mine, withQ)), "bad_answers");
});

test("apply: success freezes a snapshot, tells staff, blocks duplicates, allows re-apply after withdrawing", async () => {
    const e = await entity();
    const i = await internship(e, { screeningQuestions: [{ question: "Why us?", type: "text", options: [], required: true }] });
    const u = await student(e, { collegeUid: "SNAP-1", cgpa: 8.4 });
    const qid = String(i.screeningQuestions[0]._id);
    const r = await apply(u, i, { coverLetter: "hi", answers: [{ questionId: qid, answer: "Because" }] });
    assert.ok(r.ok);
    const app = await CampusApplication.findById((r as { applicationId: string }).applicationId).lean();
    assert.equal(app!.status, "applied");
    assert.equal(app!.applicantSnapshot.uid, "SNAP-1");
    assert.equal(app!.applicantSnapshot.cgpa, 8.4);
    assert.equal(app!.answers[0].answer, "Because");
    assert.ok(await CollegeNotification.exists({ entityId: e._id, type: "campus_new_applicant" }));

    assert.equal(code(await apply(u, i)), "already_applied");
    const app1 = String(app!._id);
    assert.ok((await withdrawCampusApplication(u, app1, false)).ok);
    const again = await apply(u, i, { answers: [{ questionId: qid, answer: "Still because" }] });
    assert.ok(again.ok);
    assert.equal((again as { applicationId: string }).applicationId, app1); // same record reused
    const re = await CampusApplication.findById(app1).lean();
    assert.deepEqual([re!.status, re!.answers[0].answer, re!.statusHistory.length], ["applied", "Still because", 3]); // applied, withdrawn, applied again
    assert.equal(await CampusApplication.countDocuments({ internshipId: i._id, studentId: u }), 1);
});

test("apply: maxApplications is honoured even when two students apply at once", async () => {
    const e = await entity();
    const i = await internship(e, { maxApplications: 1 });
    const [a, b] = await Promise.all([student(e), student(e)]);
    const results = await Promise.all([apply(a, i), apply(b, i)]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(await CampusApplication.countDocuments({ internshipId: i._id, status: { $ne: "withdrawn" } }), 1);
});

test("blacklist: bars applying anywhere in that campus only, with the reason; unban restores", async () => {
    const e = await entity(), other = await entity();
    const u = await student(e);
    const i1 = await internship(e), i2 = await internship(e);
    const otherUnrelated = await internship(other);
    assert.ok((await apply(u, i1)).ok);

    const short = await banStudent(e, u, staff as never, "x", false);
    assert.ok(!short.ok && short.code === "reason_required");
    assert.ok(!(await banStudent(e, String(id()), staff as never, "Cheating in OA", false)).ok); // stranger
    const ban = await banStudent(e, u, staff as never, "Cheating in OA", true);
    assert.ok(ban.ok && ban.removed === 1);
    assert.equal((await CampusApplication.findOne({ internshipId: i1._id, studentId: u }).lean())!.status, "removed");
    assert.ok(!(await banStudent(e, u, staff as never, "again please", false)).ok); // already banned

    const blocked = await apply(u, i2);
    assert.equal(code(blocked), "banned");
    assert.match((blocked as { error: string }).error, /Cheating in OA/);
    assert.equal((await listBlacklist(e._id)).length, 1);
    assert.equal((await listBlacklist(other._id)).length, 0);
    assert.ok(await StudentNotification.exists({ recipientId: u, type: "campus_banned" }));
    assert.ok(await OutboundMessage.exists({ recipientId: u, kind: "banned" })); // banned students still hear it (via the stub/outbox)

    assert.ok((await unbanStudent(e, u, staff as never)).ok);
    assert.ok(!(await unbanStudent(e, u, staff as never)).ok);
    assert.ok((await apply(u, i2)).ok);
    void otherUnrelated;
});

test("remove from an internship is not a ban; reinstate lets them back", async () => {
    const e = await entity();
    const u = await student(e);
    const i1 = await internship(e), i2 = await internship(e);
    const r = await apply(u, i1);
    assert.ok(r.ok);
    const appId = (r as { applicationId: string }).applicationId;
    assert.ok((await removeFromInternship(e, appId, staff as never, "Fake ID")).ok);
    const app = await CampusApplication.findById(appId).lean();
    assert.deepEqual([app!.status, app!.removal?.reason], ["removed", "Fake ID"]);
    assert.equal(await CampusBlacklist.countDocuments({ studentId: u }), 0);
    assert.equal(code(await apply(u, i1)), "removed"); // blocked here...
    assert.ok((await apply(u, i2)).ok); // ...but fine elsewhere
    const detail = await loadCampusApplication(u, appId);
    assert.equal(detail!.status, "removed");
    assert.equal(detail!.removalReason, "Fake ID");
    assert.ok(!(await removeFromInternship(e, appId, staff as never)).ok); // already removed
    assert.ok((await reinstate(e, appId, staff as never)).ok);
    assert.equal((await CampusApplication.findById(appId).lean())!.status, "applied");
    assert.equal((await CampusApplication.findById(appId).lean())!.removal, null);
});

test("pipeline: valid transitions only, concurrent changes conflict, bulk reports failures, other campus is 404", async () => {
    const e = await entity(), other = await entity();
    const [u1, u2] = [await student(e), await student(e)];
    const i = await internship(e);
    const a1 = (await apply(u1, i) as { applicationId: string }).applicationId, a2 = (await apply(u2, i) as { applicationId: string }).applicationId;

    const jump = await changeCampusStatus(e, a1, "offered", staff as never);
    assert.ok(!jump.ok && jump.code === "bad_transition"); // applied -> offered is not allowed
    const bad = await changeCampusStatus(e, a1, "accepted", staff as never);
    assert.ok(!bad.ok && bad.code === "bad_transition"); // only the student accepts
    assert.ok(!(await changeCampusStatus(e, a1, "removed", staff as never)).ok); // use remove

    const [x, y] = await Promise.all([changeCampusStatus(e, a1, "shortlisted", staff as never), changeCampusStatus(e, a1, "rejected", staff as never)]);
    assert.equal([x, y].filter((r) => r.ok).length, 1);

    const ghost = String(id());
    const bulk = await bulkChangeStatus(e, [a2, ghost], "in_process", staff as never);
    assert.deepEqual([bulk.updated, bulk.failed.map((f) => f.id)], [[a2], [ghost]]);
    assert.equal((await bulkChangeStatus(e, [a2], "applied" as never, staff as never)).failed.length, 1); // reinstate is not a bulk status

    assert.ok(!(await changeCampusStatus(other, a2, "shortlisted", staff as never)).ok); // other campus cannot touch it
    assert.equal(await campusApplicantDetail(other._id, a2), null);
    assert.ok(await StudentNotification.exists({ recipientId: u2, type: "campus_application_status" }));
    assert.ok(await OutboundMessage.exists({ recipientId: u2, kind: "app-status" }));
});

test("offers: window from policy, accept/decline, one-offer policy, lapse", async () => {
    const e = await entity({ policy: { oneStudentOneOffer: true, acceptWindowHours: 24 } });
    const u = await student(e);
    const [i1, i2] = [await internship(e), await internship(e)];
    const a1 = (await apply(u, i1) as { applicationId: string }).applicationId, a2 = (await apply(u, i2) as { applicationId: string }).applicationId;
    for (const a of [a1, a2]) {
        assert.ok((await changeCampusStatus(e, a, "shortlisted", staff as never)).ok);
        assert.ok((await changeCampusStatus(e, a, "offered", staff as never)).ok);
    }
    const offered = await CampusApplication.findById(a1).lean();
    const hours = (offered!.offer!.acceptBy!.getTime() - Date.now()) / 3_600_000;
    assert.ok(hours > 23.9 && hours <= 24);

    assert.ok(!(await respondToOffer(String(id()), a1, "accept")).ok); // not theirs
    const acc = await respondToOffer(u, a1, "accept");
    assert.ok(acc.ok);
    const second = await respondToOffer(u, a2, "accept");
    assert.ok(!second.ok); // a2 was withdrawn automatically (one offer per student)
    assert.equal((await CampusApplication.findById(a2).lean())!.status, "withdrawn");
    assert.equal((await CampusApplication.findById(a1).lean())!.status, "accepted");

    // lapse
    const v = await student(e);
    const a3 = (await apply(v, await internship(e)) as { applicationId: string }).applicationId;
    await changeCampusStatus(e, a3, "shortlisted", staff as never);
    await changeCampusStatus(e, a3, "offered", staff as never);
    await CampusApplication.updateOne({ _id: a3 }, { $set: { "offer.acceptBy": new Date(Date.now() - 1000) } });
    assert.equal(code(await respondToOffer(v, a3, "accept")), "offer_expired");
    // decline
    const w = await student(e);
    const a4 = (await apply(w, await internship(e)) as { applicationId: string }).applicationId;
    await changeCampusStatus(e, a4, "shortlisted", staff as never);
    await changeCampusStatus(e, a4, "offered", staff as never);
    assert.ok((await respondToOffer(w, a4, "decline")).ok);
    assert.equal(code(await respondToOffer(w, a4, "accept")), "not_offered");
});

test("one-offer policy off: several offers can be accepted", async () => {
    const e = await entity();
    const u = await student(e);
    const ids: string[] = [];
    for (let k = 0; k < 2; k++) {
        const a = (await apply(u, await internship(e)) as { applicationId: string }).applicationId;
        await changeCampusStatus(e, a, "shortlisted", staff as never);
        await changeCampusStatus(e, a, "offered", staff as never);
        ids.push(a);
    }
    for (const a of ids) assert.ok((await respondToOffer(u, a, "accept")).ok);
});

test("rounds, notes and ratings are staff-only: students never see them, exports omit them", async () => {
    const e = await entity();
    const u = await student(e);
    const i = await internship(e, { rounds: [{ name: "Tech 1", type: "technical" }] });
    const a = (await apply(u, i) as { applicationId: string }).applicationId;
    assert.ok((await setRoundResult(e, a, { name: "Tech 1", result: "cleared" })).ok);
    assert.ok((await setRoundResult(e, a, { name: "Tech 1", result: "rejected", note: "weak DS" })).ok); // replaces
    assert.ok(!(await setRoundResult(e, a, { name: "Tech 1", result: "bogus" as never })).ok);
    assert.ok((await addNote(e._id, a, staff.id, "SECRET-NOTE-123")).ok);
    assert.ok((await setRating(e._id, a, 5)).ok);
    assert.ok(!(await setRating(e._id, a, 9)).ok);
    const app = await CampusApplication.findById(a).lean();
    assert.equal(app!.rounds.length, 1);
    assert.equal(app!.rounds[0].result, "rejected");

    const student_ = JSON.stringify(await loadCampusApplication(u, a)) + JSON.stringify(await loadCampusApplied(u));
    assert.ok(!student_.includes("SECRET-NOTE-123") && !student_.includes("weak DS") && !/rating/i.test(student_));
    const staffView = await campusApplicantDetail(e._id, a);
    assert.equal(staffView.notes[0].text, "SECRET-NOTE-123");
    const exp = await buildExport(e._id, String(i._id));
    assert.ok(!JSON.stringify(exp).includes("SECRET-NOTE-123") && !JSON.stringify(exp).includes("weak DS"));
});

test("staff list: scoped, filters, search escaped, counts", async () => {
    const e = await entity(), other = await entity();
    const [u1, u2, o1] = [await student(e, { collegeUid: "FIND-ME" }), await student(e), await student(other)];
    const i = await internship(e), oi = await internship(other);
    await apply(u1, i); const a2 = (await apply(u2, i) as { applicationId: string }).applicationId; await apply(o1, oi);
    await changeCampusStatus(e, a2, "shortlisted", staff as never);
    const all = await listCampusApplicants(e._id);
    assert.equal(all.items.length, 2);
    assert.deepEqual(all.counts, { applied: 1, shortlisted: 1 });
    assert.equal((await listCampusApplicants(e._id, { status: "shortlisted" })).items.length, 1);
    assert.equal((await listCampusApplicants(e._id, { q: "find-me" })).items.length, 1);
    assert.equal((await listCampusApplicants(e._id, { q: ".*" })).items.length, 0);
    assert.equal((await listCampusApplicants(e._id, { internshipId: String(oi._id) })).items.length, 0);
});

test("remove student from campus: open applications removed, detached, count follows", async () => {
    const e = await entity();
    const u = await student(e);
    const a = (await apply(u, await internship(e)) as { applicationId: string }).applicationId;
    const r = await removeStudentFromCampus(e, u, staff as never, "Left college");
    assert.ok(r.ok && r.removed === 1);
    assert.equal((await CampusApplication.findById(a).lean())!.status, "removed");
    assert.equal((await getEnrollment(u))!.entityId, null);
    assert.equal((await CampusEntity.findById(e._id).lean())!.studentCount, 0);
    assert.ok(!(await removeStudentFromCampus(e, u, staff as never)).ok);
    assert.equal((await loadCampusApplied(u)).length, 1); // records stay with the student
});

test("export: formula injection neutralised, csv/xlsx/json, per-question columns, campus scope", async () => {
    assert.equal(safeCell("=SUM(A1)"), "'=SUM(A1)");
    for (const bad of ["+1", "-1", "@x", "\tx", "\rx"]) assert.ok(safeCell(bad).startsWith("'"), bad);
    assert.equal(safeCell("Plain"), "Plain");
    assert.equal(safeCell(null), "");

    const e = await entity(), other = await entity();
    const i = await internship(e, { company: { name: "=HYPERLINK(\"http://evil\")" }, screeningQuestions: [{ question: "Why?", type: "text", options: [], required: false }, { question: "Notice period", type: "number", options: [], required: false }] });
    const evil = await student(e, { collegeUid: "=cmd|' /C calc'!A0", department: "CSE, \"quoted\"" });
    const ok = await student(e);
    const oi = await internship(other);
    const o = await student(other);
    await apply(evil, i, { answers: [{ questionId: String(i.screeningQuestions[0]._id), answer: "+SUM(1)" }] });
    await apply(ok, i);
    await apply(o, oi);

    const one = await buildExport(e._id, String(i._id));
    assert.equal(one.count, 2);
    assert.ok(one.header.includes("Q: Why?") && one.header.includes("Q: Notice period"));
    const csv = toCsv(one.header, one.rows);
    assert.ok(csv.startsWith("﻿"));
    assert.ok(csv.includes("'=cmd|"), "college id neutralised");
    assert.ok(csv.includes("'=HYPERLINK"), "company neutralised");
    assert.ok(csv.includes("'+SUM(1)"), "answer neutralised");
    assert.ok(csv.includes('"CSE, ""quoted"""'), "csv quoting");
    assert.ok(!/(^|,)=/m.test(csv.replace(/"[^"]*"/g, "")), "no raw formula cell");
    const x = await toXlsx(one.header, one.rows);
    assert.equal(x.subarray(0, 2).toString(), "PK"); // a real xlsx (zip)
    assert.equal(one.records.length, 2);

    const whole = await buildExport(e._id);
    assert.equal(whole.count, 2);
    assert.ok(whole.header.includes("Screening answers"));
    assert.equal((await buildExport(other._id)).count, 1);
    assert.equal((await buildExport(e._id, String(oi._id))).count, 0); // another campus's internship id yields nothing
});
