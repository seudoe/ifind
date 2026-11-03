import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { campusInternshipDraftSchema, campusInternshipPublishSchema } from "../lib/campus/internshipSchema";
import { duplicateFields, loadCampusInternship, syncCampusAutoClose, visibleToCampusStudentsFilter, CAMPUS_STATUS_TRANSITIONS } from "../lib/campus/internships";
import CampusApplication from "../models/CampusApplication";
import CampusInternship from "../models/CampusInternship";
import Internship from "../models/Internship";
import PlatformInternship from "../models/PlatformInternship";

const id = () => new mongoose.Types.ObjectId();
const entityA = id(), entityB = id(), college = id(), emp = id();
let server: { stop: () => Promise<boolean> } | null = null;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

const day = 86_400_000;
const mk = (entityId: mongoose.Types.ObjectId, over: Record<string, unknown> = {}) =>
    CampusInternship.create({ entityId, collegeId: college, postedBy: emp, company: { name: "Acme" }, designation: "SDE Intern", ...over });

test("a draft needs only the company and the designation", () => {
    const ok = campusInternshipDraftSchema.safeParse({ company: { name: "Acme" }, designation: "SDE Intern" });
    assert.ok(ok.success);
    assert.equal(ok.data!.deadlineDate, null);
    assert.equal(ok.data!.requireResume, true);
    assert.equal(campusInternshipDraftSchema.safeParse({ company: { name: "A" }, designation: "SDE" }).success, false);
    assert.equal(campusInternshipDraftSchema.safeParse({ company: { name: "Acme" }, designation: "" }).success, false);
    assert.equal(campusInternshipDraftSchema.safeParse({ designation: "SDE Intern" }).success, false);
});

test("late fields are optional; blanks become null; bad values rejected", () => {
    const r = campusInternshipDraftSchema.safeParse({
        company: { name: "Acme", tier: "", website: "" }, designation: "SDE Intern",
        interviewDate: "", openings: "", eligibility: { minCgpa: "7.5", batches: ["2027"] },
    });
    assert.ok(r.success);
    assert.equal(r.data!.interviewDate, null);
    assert.equal(r.data!.openings, null);
    assert.equal(r.data!.eligibility.minCgpa, 7.5);
    assert.deepEqual(r.data!.eligibility.batches, [2027]);
    assert.equal(campusInternshipDraftSchema.safeParse({ company: { name: "Acme", website: "javascript:alert(1)" }, designation: "SDE Intern" }).success, false);
    assert.equal(campusInternshipDraftSchema.safeParse({ company: { name: "Acme" }, designation: "SDE Intern", screeningQuestions: Array(11).fill({ question: "Why?", type: "text" }) }).success, false);
});

test("publishing needs a deadline", () => {
    const base = { company: { name: "Acme" }, designation: "SDE Intern" };
    assert.equal(campusInternshipPublishSchema.safeParse(base).success, false);
    assert.ok(campusInternshipPublishSchema.safeParse({ ...base, deadlineDate: new Date(Date.now() + day).toISOString() }).success);
});

test("lifecycle transitions", () => {
    assert.deepEqual(CAMPUS_STATUS_TRANSITIONS.publish.from, ["draft"]);
    assert.deepEqual(CAMPUS_STATUS_TRANSITIONS.close.from, ["open"]);
    assert.deepEqual(CAMPUS_STATUS_TRANSITIONS.archive.from, ["closed"]);
});

test("lazy auto-close: past deadline and full are closed, others untouched, other campus untouched", async () => {
    const past = await mk(entityA, { status: "open", deadlineDate: new Date(Date.now() - 1000) });
    const future = await mk(entityA, { status: "open", deadlineDate: new Date(Date.now() + day) });
    const full = await mk(entityA, { status: "open", deadlineDate: new Date(Date.now() + day), maxApplications: 1 });
    const draftPast = await mk(entityA, { status: "draft", deadlineDate: new Date(Date.now() - 1000) });
    const otherPast = await mk(entityB, { status: "open", deadlineDate: new Date(Date.now() - 1000) });
    await CampusApplication.create({
        entityId: entityA, internshipId: full._id, studentId: id(), enrollmentId: id(),
        applicantSnapshot: { name: "x", uid: "1", course: "B.Tech", department: "CSE", batch: 2027, email: "x@x.edu" },
    });

    const closed = await syncCampusAutoClose(entityA);
    assert.deepEqual(closed.map(String).sort(), [String(past._id), String(full._id)].sort());
    assert.equal((await CampusInternship.findById(past._id).lean())!.status, "closed");
    assert.ok((await CampusInternship.findById(past._id).lean())!.closedAt);
    assert.equal((await CampusInternship.findById(future._id).lean())!.status, "open");
    assert.equal((await CampusInternship.findById(draftPast._id).lean())!.status, "draft");
    assert.equal((await CampusInternship.findById(otherPast._id).lean())!.status, "open");
});

test("student visibility filter: open, not past deadline, own entity only", async () => {
    const vis = await mk(entityA, { status: "open", deadlineDate: new Date(Date.now() + day) });
    const noDeadline = await mk(entityA, { status: "open" });
    const draft = await mk(entityA, { status: "draft" });
    const expired = await mk(entityA, { status: "open", deadlineDate: new Date(Date.now() - 1000) });
    const elsewhere = await mk(entityB, { status: "open", deadlineDate: new Date(Date.now() + day) });
    const ids = (await CampusInternship.find(visibleToCampusStudentsFilter(entityA)).select("_id").lean()).map((d) => String(d._id));
    assert.ok(ids.includes(String(vis._id)) && ids.includes(String(noDeadline._id)));
    for (const x of [draft, expired, elsewhere]) assert.ok(!ids.includes(String(x._id)));
});

test("cross-entity isolation: an internship id from another campus is a 404", async () => {
    const mine = await mk(entityA), theirs = await mk(entityB);
    assert.equal((await loadCampusInternship(entityA, String(mine._id))) instanceof mongoose.Document, true);
    const res = await loadCampusInternship(entityA, String(theirs._id));
    assert.equal((res as Response).status, 404);
    assert.equal(((await loadCampusInternship(entityA, "nope")) as Response).status, 404);
});

test("duplicate makes a fresh draft without deadline, ids or emailed flag", async () => {
    const src = await mk(entityA, {
        status: "open", deadlineDate: new Date(Date.now() + day), emailedAt: new Date(),
        screeningQuestions: [{ question: "Why?", type: "text", options: [], required: true }],
    });
    const copy = await CampusInternship.create(duplicateFields(src, emp));
    assert.notEqual(String(copy._id), String(src._id));
    assert.equal(copy.status, "draft");
    assert.equal(copy.deadlineDate, null);
    assert.equal(copy.emailedAt, null);
    assert.match(copy.designation, /\(copy\)$/);
    assert.equal(copy.screeningQuestions.length, 1);
    assert.notEqual(String(copy.screeningQuestions[0]._id), String(src.screeningQuestions[0]._id));
});

test("campus internships never live in the company or scraped collections", async () => {
    assert.equal(CampusInternship.collection.name, "campus-internships");
    assert.notEqual(CampusInternship.collection.name, Internship.collection.name);
    assert.notEqual(CampusInternship.collection.name, PlatformInternship.collection.name);
    assert.equal(await Internship.collection.countDocuments(), 0);
    assert.equal(await PlatformInternship.collection.countDocuments(), 0);
});
