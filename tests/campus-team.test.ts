import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { closeCampusEntity } from "../lib/campus/deletion";
import { createCampusEntity } from "../lib/campus/entities";
import { employerFeed, employerUnreadCount, markEmployerRead } from "../lib/employer/notifications";
import { notifyCollege } from "../lib/campus/notify";
import { addMember, removeMember, setMemberRole, teamChangeError } from "../lib/campus/team";
import { campusCreateSchema } from "../lib/campus/validation";
import CampusApplication from "../models/CampusApplication";
import CampusEnrollment from "../models/CampusEnrollment";
import CampusEntity from "../models/CampusEntity";
import CampusInternship from "../models/CampusInternship";
import College from "../models/College";
import { StudentNotification } from "../models/Notification";
import User from "../models/User";
import { CAMPUS_ROLES, type CampusApplicationStatus, type CampusInternshipStatus, type CampusRole } from "../types/campus";

const id = () => new mongoose.Types.ObjectId();
const collegeId = id();
let server: { stop: () => Promise<boolean> } | null = null;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
    await College.collection.insertOne({ _id: collegeId, name: "Team Test College" });
    await CampusEntity.syncIndexes();
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

const fresh = async (owner = id()) => {
    const r = await createCampusEntity(owner, campusCreateSchema.parse({ name: `Cell ${id()}`, collegeId: String(collegeId) }));
    assert.ok(r.ok);
    if (!r.ok) throw new Error("create failed");
    return { entity: r.entity, owner };
};

test("permission matrix (3.2)", () => {
    const err = (a: CampusRole, t: CampusRole | null, n: CampusRole | null, self = false) => teamChangeError(a, t, n, self);
    // viewer and coordinator cannot manage the team
    for (const a of ["viewer", "coordinator"] as const) {
        assert.ok(err(a, null, "viewer"), `${a} add`);
        assert.ok(err(a, "viewer", "coordinator"), `${a} change`);
        assert.ok(err(a, "viewer", null), `${a} remove other`);
        assert.equal(err(a, a, null, true), null, `${a} may leave`);
    }
    // admin manages non-owners, not owners
    assert.equal(err("admin", null, "coordinator"), null);
    assert.equal(err("admin", "viewer", "admin"), null);
    assert.equal(err("admin", "coordinator", null), null);
    assert.ok(err("admin", null, "owner"), "admin cannot add owner");
    assert.ok(err("admin", "owner", null), "admin cannot remove owner");
    assert.ok(err("admin", "owner", "admin"), "admin cannot demote owner");
    assert.ok(err("admin", "admin", "owner", true), "admin cannot promote self to owner");
    // owner can do everything
    for (const t of CAMPUS_ROLES) assert.equal(err("owner", t, null), null);
    assert.equal(err("owner", null, "owner"), null);
});

test("sole owner can neither leave nor be demoted; with a second owner both work", async () => {
    const { entity, owner } = await fresh();
    assert.equal(await removeMember(entity._id, owner, true), false);
    assert.equal(await setMemberRole(entity._id, owner, "admin", true), false);
    const second = id();
    assert.equal(await addMember(entity._id, second, "owner", owner), true);
    assert.equal(await addMember(entity._id, second, "viewer", owner), false, "no duplicate member");
    assert.equal(await setMemberRole(entity._id, owner, "admin", true), true);
    assert.equal(await removeMember(entity._id, owner, false), true);
    const after = await CampusEntity.findById(entity._id).lean();
    assert.deepEqual(after!.members.map((m) => [String(m.employerId), m.role]), [[String(second), "owner"]]);
});

test("two owners leaving at the same moment cannot orphan the campus", async () => {
    const { entity, owner } = await fresh();
    const second = id();
    await addMember(entity._id, second, "owner", owner);
    const results = await Promise.all([removeMember(entity._id, owner, true), removeMember(entity._id, second, true)]);
    assert.equal(results.filter(Boolean).length, 1);
    const after = await CampusEntity.findById(entity._id).lean();
    assert.equal(after!.members.filter((m) => m.role === "owner").length, 1);
});

test("deleting a campus: internships close, active applications withdrawn, students detached and notified, other campus untouched", async () => {
    const { entity } = await fresh();
    const { entity: other } = await fresh();
    const mkStudent = async (name: string, ent: mongoose.Types.ObjectId) => {
        const u = await User.create({ name, username: name, email: `${name}@x.edu` });
        await CampusEnrollment.create({ userId: u._id, collegeId, entityId: ent, course: "B.Tech", department: "CSE", collegeUid: name, batch: 2027 });
        return u;
    };
    const s1 = await mkStudent("del1", entity._id), s2 = await mkStudent("del2", other._id);
    const mkIntern = (ent: mongoose.Types.ObjectId, status: CampusInternshipStatus) =>
        CampusInternship.create({ entityId: ent, collegeId, postedBy: id(), status, company: { name: "Acme" }, designation: "SDE" });
    const open = await mkIntern(entity._id, "open"), draft = await mkIntern(entity._id, "draft"), otherOpen = await mkIntern(other._id, "open");
    const snap = { name: "x", uid: "1", course: "B.Tech", department: "CSE", batch: 2027, email: "x@x.edu" };
    const mkApp = (ent: mongoose.Types.ObjectId, intern: mongoose.Types.ObjectId, student: mongoose.Types.ObjectId, status: CampusApplicationStatus) =>
        CampusApplication.create({ entityId: ent, internshipId: intern, studentId: student, enrollmentId: id(), status, applicantSnapshot: snap });
    const a1 = await mkApp(entity._id, open._id, s1._id, "shortlisted");
    const a2 = await mkApp(entity._id, draft._id, s1._id, "rejected");
    const a3 = await mkApp(other._id, otherOpen._id, s2._id, "applied");

    const res = await closeCampusEntity(entity, "deleted");
    assert.deepEqual([res.closed, res.students, res.withdrawn], [true, 1, 1]);
    assert.equal((await CampusEntity.findById(entity._id).lean())!.isActive, false);
    assert.equal((await CampusInternship.findById(open._id).lean())!.status, "closed");
    assert.equal((await CampusInternship.findById(draft._id).lean())!.status, "closed");
    assert.equal((await CampusApplication.findById(a1._id).lean())!.status, "withdrawn");
    assert.equal((await CampusApplication.findById(a2._id).lean())!.status, "rejected"); // final stays as it was
    assert.equal((await CampusEnrollment.findOne({ userId: s1._id }).lean())!.entityId, null);
    assert.equal((await StudentNotification.countDocuments({ recipientId: s1._id, type: "campus_entity_closed" })), 1);
    // untouched
    assert.equal((await CampusInternship.findById(otherOpen._id).lean())!.status, "open");
    assert.equal((await CampusApplication.findById(a3._id).lean())!.status, "applied");
    assert.equal(String((await CampusEnrollment.findOne({ userId: s2._id }).lean())!.entityId), String(other._id));
    // idempotent
    assert.equal((await closeCampusEntity(entity, "deleted")).closed, false);
});

test("campus notifications reach staff only, from the day they joined, with per-person read state", async () => {
    const { entity, owner } = await fresh();
    const later = id(), outsider = id();
    await notifyCollege({ entityId: entity._id, type: "campus_member_added", title: "old event" });
    await new Promise((r) => setTimeout(r, 20));
    await addMember(entity._id, later, "viewer", owner);
    await CampusEntity.updateOne({ _id: entity._id, "members.employerId": later }, { $set: { "members.$.addedAt": new Date() } });
    await new Promise((r) => setTimeout(r, 20));
    await notifyCollege({ entityId: entity._id, type: "campus_member_role", title: "new event" });

    const ownerFeed = await employerFeed(owner);
    assert.deepEqual(ownerFeed.items.filter((i) => i.scope === "college").map((i) => i.title).sort(), ["new event", "old event"]);
    assert.deepEqual((await employerFeed(later)).items.map((i) => i.title), ["new event"]);
    assert.equal((await employerFeed(outsider)).items.length, 0);

    const ownerItem = ownerFeed.items.find((i) => i.title === "new event")!;
    await markEmployerRead(owner, { id: ownerItem._id, scope: "college" });
    assert.equal(await employerUnreadCount(owner), 1);
    assert.equal(await employerUnreadCount(later), 1); // read state is per person
});
