import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { isEligible } from "../lib/campus/eligibility";
import { JOIN_CODE_ALPHABET, generateJoinCode, normalizeJoinCode } from "../lib/campus/joinCode";
import { idempotencyKey, resolveStudentRecipients, sendToStaff, sendToStudents, type Recipient, type Transport } from "../lib/campus/outbound";
import { applicationStatusMessage } from "../lib/campus/messages";
import { dispatchEmail } from "../lib/messaging/email";
import { dispatchSms } from "../lib/messaging/sms";
import { CAMPUS_ACTIVE_STATUSES, CAMPUS_FINAL_STATUSES, CAMPUS_APPLICATION_STATUSES, canStaffTransition, isEventAudience } from "../types/campus";

const stu = { batch: 2027, course: "B.Tech", department: "CSE", cgpa: 8, activeBacklogs: 0 };

test("eligibility", () => {
    assert.equal(isEligible(stu, {}).ok, true);
    assert.equal(isEligible(stu, { batches: [2027, 2028], courses: ["b.tech"], departments: ["cse", "it"], minCgpa: 7.5, maxBacklogs: 0 }).ok, true);
    assert.equal(isEligible(stu, { batches: [2026] }).ok, false);
    assert.equal(isEligible(stu, { departments: ["ECE"] }).reasons.length, 1);
    assert.equal(isEligible(stu, { minCgpa: 8.5 }).ok, false);
    assert.equal(isEligible({ ...stu, cgpa: null }, { minCgpa: 6 }).ok, false); // unknown value with a set rule excludes
    assert.equal(isEligible({ ...stu, activeBacklogs: 2 }, { maxBacklogs: 1 }).ok, false);
    assert.equal(isEligible({ ...stu, cgpa: null }, {}).ok, true);
});

test("join code: alphabet, length, uniqueness, normalisation", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
        const c = generateJoinCode();
        assert.equal(c.length, 8);
        assert.ok([...c].every((ch) => JOIN_CODE_ALPHABET.includes(ch)));
        seen.add(c);
    }
    assert.ok(seen.size > 1990);
    assert.ok(!/[01OIL]/.test(JOIN_CODE_ALPHABET));
    assert.equal(normalizeJoinCode("abcd-2345"), "ABCD2345");
    assert.equal(normalizeJoinCode(" abcd 2345 "), "ABCD2345");
    assert.equal(normalizeJoinCode("ABCD234"), null);
    assert.equal(normalizeJoinCode("ABCD0000"), null); // 0 is not in the alphabet
    assert.equal(normalizeJoinCode(123), null);
});

test("status model: final vs active, transitions, audiences", () => {
    assert.deepEqual([...CAMPUS_FINAL_STATUSES].sort(), ["declined", "rejected", "removed", "withdrawn"]);
    assert.equal(CAMPUS_ACTIVE_STATUSES.length + CAMPUS_FINAL_STATUSES.length, CAMPUS_APPLICATION_STATUSES.length);
    for (const s of ["applied", "shortlisted", "in_process", "offered", "accepted"] as const) assert.ok(CAMPUS_ACTIVE_STATUSES.includes(s));
    assert.equal(canStaffTransition("applied", "shortlisted"), true);
    assert.equal(canStaffTransition("withdrawn", "applied"), false);
    assert.equal(canStaffTransition("removed", "applied"), true); // reinstate
    assert.equal(canStaffTransition("applied", "accepted"), false);
    assert.ok(isEventAudience("all_members") && isEventAudience("round:Technical 1") && isEventAudience("batch:2027"));
    assert.ok(!isEventAudience("batch:27") && !isEventAudience("everyone"));
});

test("transport stubs do nothing and never throw", async () => {
    assert.deepEqual(await dispatchEmail({ to: "a@b.co", subject: "s", text: "t" }), { ok: false, skipped: "not_implemented" });
    assert.deepEqual(await dispatchSms({ to: "+911234567890", text: "t" }), { ok: false, skipped: "not_implemented" });
    assert.equal((await dispatchEmail({ to: "", subject: "s", text: "t" })).skipped, "no_recipient");
});

// ── outbound fan-out ────────────────────────────────────────────────────────────────────────────────────────────────
const spy = (opts: { throwEmail?: boolean } = {}) => {
    const emails: Parameters<Transport["email"]>[0][] = [];
    const sms: Parameters<Transport["sms"]>[0][] = [];
    const transport: Transport = {
        email: async (m) => { emails.push(m); if (opts.throwEmail) throw new Error("boom"); return { ok: true }; },
        sms: async (m) => { sms.push(m); return { ok: true }; },
    };
    return { emails, sms, transport };
};
const rec = (id: string, over: Partial<Recipient> = {}): Recipient => ({ id, email: `${id}@x.edu`, name: id, phone: "+911111111111", emailUpdates: true, smsUpdates: false, ...over });
const build = () => applicationStatusMessage({ company: "Acme", designation: "SDE", status: "shortlisted", link: "/x" });

test("sendToStudents: one email per recipient, single address, opt-outs respected, sms gated", async () => {
    const s = spy();
    const counts = await sendToStudents([rec("a"), rec("b", { emailUpdates: false }), rec("c", { smsUpdates: true }), rec("d", { email: null })], build, { email: true, sms: true, kind: "internship", refId: "I1", transport: s.transport });
    assert.deepEqual(s.emails.map((m) => m.to).sort(), ["a@x.edu", "c@x.edu"]);
    assert.ok(s.emails.every((m) => typeof m.to === "string" && !m.to.includes(",")));
    assert.deepEqual(s.sms.map((m) => m.to), ["+911111111111"]); // only c opted in to sms
    assert.equal(counts.emailed, 2);
    assert.equal(new Set(s.emails.map((m) => m.idempotencyKey)).size, 2);
});

test("sendToStudents: sms never called when the channel is off", async () => {
    const s = spy();
    await sendToStudents([rec("c", { smsUpdates: true })], build, { email: true, sms: false, kind: "event", refId: "E1", transport: s.transport });
    assert.equal(s.sms.length, 0);
});

test("a throwing transport is counted, never thrown; keys differ per version", async () => {
    const s = spy({ throwEmail: true });
    const counts = await sendToStudents([rec("a"), rec("b")], build, { email: true, kind: "event", refId: "E1", transport: s.transport });
    assert.equal(counts.failed, 2);
    assert.notEqual(idempotencyKey("event", "E1", "a", 1), idempotencyKey("event", "E1", "a", 2));
});

test("sendToStaff: email only, no sms", async () => {
    const s = spy();
    await sendToStaff([{ id: "s1", email: "s1@x.edu" }], build, { email: true, kind: "staff", refId: "S1", transport: s.transport });
    assert.equal(s.emails.length, 1);
    assert.equal(s.sms.length, 0);
});

// ── recipient resolution (DB) ───────────────────────────────────────────────────────────────────────────────────────
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

test("resolveStudentRecipients: only joined, unbanned, non-blacklisted, eligible students of that entity", async () => {
    const User = (await import("../models/User")).default;
    const CampusEnrollment = (await import("../models/CampusEnrollment")).default;
    const CampusBlacklist = (await import("../models/CampusBlacklist")).default;
    const id = () => new mongoose.Types.ObjectId();
    const entity = id(), other = id(), college = id(), emp = id();
    const mk = async (name: string, ent: mongoose.Types.ObjectId | null, extra: Record<string, unknown> = {}, enr: Record<string, unknown> = {}) => {
        const u = await User.create({ name, username: name, email: `${name}@x.edu`, ...extra });
        await CampusEnrollment.create({ userId: u._id, collegeId: college, entityId: ent, course: "B.Tech", department: "CSE", collegeUid: name, batch: 2027, cgpa: 8, ...enr });
        return u;
    };
    const ok = await mk("ok", entity);
    await mk("banned", entity, { isBanned: true });
    const listed = await mk("blacklisted", entity);
    await CampusBlacklist.create({ entityId: entity, studentId: listed._id, reason: "x", bannedBy: emp });
    const lifted = await mk("lifted", entity);
    await CampusBlacklist.create({ entityId: entity, studentId: lifted._id, reason: "x", bannedBy: emp, active: false });
    await mk("elsewhere", other);
    await mk("nojoin", null);
    await mk("lowcgpa", entity, {}, { cgpa: 5 });

    const all = await resolveStudentRecipients(String(entity));
    assert.deepEqual(all.map((r) => r.id).sort(), [String(ok._id), String(lifted._id), String((await User.findOne({ username: "lowcgpa" }))!._id)].sort());
    const eligible = await resolveStudentRecipients(String(entity), { eligibleFor: { minCgpa: 7 } });
    assert.deepEqual(eligible.map((r) => r.id).sort(), [String(ok._id), String(lifted._id)].sort());
});
