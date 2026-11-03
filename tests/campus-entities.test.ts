import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { resolveMembership } from "../lib/campus/access";
import { createCampusEntity, listInstitutes, otherCampusesOfCollege, rotateJoinCode } from "../lib/campus/entities";
import { campusCreateSchema, escapeRegex } from "../lib/campus/validation";
import CampusEntity from "../models/CampusEntity";
import College from "../models/College";
import Company from "../models/Company";

const id = () => new mongoose.Types.ObjectId();
const owner = id(), admin = id(), coord = id(), viewer = id(), stranger = id();
const collegeId = id();

let server: { stop: () => Promise<boolean> } | null = null;
before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
    await College.collection.insertOne({ _id: collegeId, name: "Test College of Engineering (TCE)" }); // test DB only; the app never writes `colleges`
    await CampusEntity.syncIndexes();
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

const input = (name: string, extra = {}) => campusCreateSchema.parse({ name, collegeId: String(collegeId), ...extra });

test("membership matrix: non-members and deleted entities are 404, low roles 403", () => {
    const members = [owner, admin, coord, viewer].map((employerId, i) => ({ employerId, role: (["owner", "admin", "coordinator", "viewer"] as const)[i], addedAt: new Date() }));
    const e = { members, isActive: true, deleteDetails: { deleted: false } } as unknown as Parameters<typeof resolveMembership>[0];
    assert.equal(resolveMembership(e, stranger, "viewer").status, "not_found");
    assert.equal(resolveMembership(e, viewer, "viewer").status, "ok");
    assert.equal(resolveMembership(e, viewer, "coordinator").status, "forbidden");
    assert.equal(resolveMembership(e, coord, "coordinator").status, "ok");
    assert.equal(resolveMembership(e, coord, "admin").status, "forbidden");
    assert.equal(resolveMembership(e, admin, "admin").status, "ok");
    assert.equal(resolveMembership(e, admin, "owner").status, "forbidden");
    assert.equal(resolveMembership(e, owner, "owner").status, "ok");
    assert.equal(resolveMembership({ ...e, isActive: false } as never, owner, "viewer").status, "not_found");
    assert.equal(resolveMembership({ ...e, deleteDetails: { deleted: true } } as never, owner, "viewer").status, "not_found");
    assert.equal(resolveMembership(null, owner, "viewer").status, "not_found");
});

test("two campuses of the same college coexist with distinct slugs and codes", async () => {
    const a = await createCampusEntity(owner, input("TCE Placement Cell"));
    const b = await createCampusEntity(admin, input("TCE Placement Cell"));
    assert.ok(a.ok && b.ok);
    if (!a.ok || !b.ok) return;
    assert.notEqual(a.entity.slug, b.entity.slug);
    assert.notEqual(a.entity.joinCode, b.entity.joinCode);
    assert.equal(a.entity.joinCode.length, 8);
    assert.equal(a.entity.members[0].role, "owner");
    assert.equal(String(a.entity.collegeId), String(b.entity.collegeId));
    const others = await otherCampusesOfCollege(String(collegeId));
    assert.equal(others.length, 2);
    assert.ok(others.every((o) => !("joinCode" in o)));
});

test("unknown college is rejected", async () => {
    const r = await createCampusEntity(owner, campusCreateSchema.parse({ name: "Ghost Cell", collegeId: String(id()) }));
    assert.equal(r.ok, false);
});

test("code_only campuses are not listed to others", async () => {
    await createCampusEntity(coord, input("Secret Cell", { listing: "code_only" }));
    const names = (await otherCampusesOfCollege(String(collegeId))).map((o) => o.name);
    assert.ok(!names.includes("Secret Cell"));
});

test("rotating the code invalidates the old one", async () => {
    const r = await createCampusEntity(viewer, input("Rotate Cell"));
    assert.ok(r.ok);
    if (!r.ok) return;
    const old = r.entity.joinCode;
    const fresh = await rotateJoinCode(r.entity);
    assert.notEqual(old, fresh);
    assert.equal(await CampusEntity.exists({ joinCode: old }), null);
    assert.ok(await CampusEntity.exists({ joinCode: fresh }));
});

test("listInstitutes merges companies and campuses for a member only", async () => {
    const u = id();
    await Company.collection.insertOne({
        name: "Acme", slug: "acme", description: "x", industry: "x", companyType: "startup", size: "1-10", contactEmail: "a@b.co",
        headquarters: { city: "x", country: "India" }, members: [{ employerId: u, role: "owner", addedAt: new Date() }], createdBy: u,
        isActive: true, deleteDetails: { deleted: false }, verification: { status: "unverified" }, createdAt: new Date(Date.now() - 1000), updatedAt: new Date(),
    });
    await createCampusEntity(u, input("U Campus"));
    const rows = await listInstitutes(u);
    assert.deepEqual(rows.map((r) => r.kind).sort(), ["college", "company"]);
    assert.equal(rows.find((r) => r.kind === "college")?.collegeName, "Test College of Engineering (TCE)");
    assert.equal((await listInstitutes(stranger)).length, 0);
});

test("college search regex is escaped", () => {
    assert.equal(escapeRegex("a.b*(c)"), "a\\.b\\*\\(c\\)");
    assert.ok(new RegExp(escapeRegex(".*"), "i").test("x.*y"));
    assert.ok(!new RegExp(escapeRegex(".*"), "i").test("xy"));
});

test("create schema rejects bad input", () => {
    assert.equal(campusCreateSchema.safeParse({ name: "ab", collegeId: String(collegeId) }).success, false);
    assert.equal(campusCreateSchema.safeParse({ name: "Good Name", collegeId: "nope" }).success, false);
    assert.equal(campusCreateSchema.safeParse({ name: "Good Name", collegeId: String(collegeId), logo: "javascript:alert(1)" }).success, false);
    assert.equal(campusCreateSchema.safeParse({ name: "Good Name", collegeId: String(collegeId), listing: "x" }).success, false);
});
