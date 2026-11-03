import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { announceInternship, sendReminders } from "../lib/campus/announce";
import { applyToCampusInternship } from "../lib/campus/apply";
import { changeCampusStatus, setRoundResult } from "../lib/campus/pipeline";
import { audienceIncludes, audienceRecipients, cancelEvent, createEvent, deleteEvent, eventForStudent, eventSchema, homeFeed, materialChanges, updateEvent } from "../lib/campus/events";
import { createCampusEntity } from "../lib/campus/entities";
import { buildIcs, fold } from "../lib/campus/ics";
import { enrollmentSchema, joinCampus, saveEnrollment, setPreferences } from "../lib/campus/student";
import { campusCreateSchema } from "../lib/campus/validation";
import CampusApplication from "../models/CampusApplication";
import CampusBlacklist from "../models/CampusBlacklist";
import CampusEntity from "../models/CampusEntity";
import CampusEvent from "../models/CampusEvent";
import CampusInternship from "../models/CampusInternship";
import College from "../models/College";
import OutboundMessage from "../models/OutboundMessage";
import { StudentNotification } from "../models/Notification";
import User from "../models/User";

const id = () => new mongoose.Types.ObjectId();
const college = id();
const staff = { id: id(), name: "Coordinator" };
let server: { stop: () => Promise<boolean> } | null = null;
let n = 0;
const day = 86_400_000;

before(async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    server = mem;
    await mongoose.connect(mem.getUri());
    await College.collection.insertOne({ _id: college, name: "Events College" });
    await Promise.all([CampusEntity.syncIndexes(), CampusBlacklist.syncIndexes(), CampusApplication.syncIndexes(), OutboundMessage.syncIndexes()]);
});
after(async () => {
    await mongoose.disconnect();
    await server?.stop();
});

const entity = async () => {
    const r = await createCampusEntity(id(), campusCreateSchema.parse({ name: `Cell ${++n}`, collegeId: String(college) }));
    assert.ok(r.ok);
    if (!r.ok) throw new Error();
    return r.entity;
};
const student = async (e: { _id: mongoose.Types.ObjectId }, details: Record<string, unknown> = {}, userOver: Record<string, unknown> = {}) => {
    const name = `ev${++n}`;
    const u = await User.create({ name, username: name, email: `${name}@x.edu`, resume: { driveViewLink: "https://cdn/r.pdf" }, ...userOver });
    assert.ok((await saveEnrollment(String(u._id), enrollmentSchema.parse({ collegeId: String(college), course: "B.Tech", department: "CSE", collegeUid: `U${n}`, batch: new Date().getFullYear() + 1, cgpa: 8, activeBacklogs: 0, ...details }))).ok);
    assert.ok((await joinCampus(String(u._id), { target: { entityId: String(e._id) }, confirm: true, confirmSwitch: false })).ok);
    return String(u._id);
};
const internship = (e: { _id: mongoose.Types.ObjectId }, over: Record<string, unknown> = {}) =>
    CampusInternship.create({ entityId: e._id, collegeId: college, postedBy: id(), status: "open", company: { name: "Acme" }, designation: "SDE", deadlineDate: new Date(Date.now() + 5 * day), ...over });
const ev = (over: Record<string, unknown> = {}) => eventSchema.parse({ title: "Pre-placement talk", startsAt: new Date(Date.now() + 3 * day).toISOString(), ...over });
const apply = (u: string, i: { _id: mongoose.Types.ObjectId }) => applyToCampusInternship(u, String(i._id), { answers: [], confirm: true }) as Promise<{ ok: boolean; applicationId: string }>;

test("audience predicate: every audience kind", () => {
    const base = { batch: 2027, eligible: true, application: null };
    const app = (status: string, extra: Record<string, unknown> = {}) => ({ ...base, application: { status, rounds: [], currentRound: null, ...extra } }) as never;
    assert.equal(audienceIncludes("all_members", base), true);
    assert.equal(audienceIncludes("eligible", base), true);
    assert.equal(audienceIncludes("eligible", { ...base, eligible: false }), false);
    assert.equal(audienceIncludes("eligible", { ...base, eligible: null }), false);
    assert.equal(audienceIncludes("applicants", base), false);
    assert.equal(audienceIncludes("applicants", app("applied")), true);
    assert.equal(audienceIncludes("applicants", app("withdrawn")), false);
    assert.equal(audienceIncludes("applicants", app("rejected")), false);
    assert.equal(audienceIncludes("shortlisted", app("applied")), false);
    for (const s of ["shortlisted", "in_process", "offered", "accepted"]) assert.equal(audienceIncludes("shortlisted", app(s)), true, s);
    assert.equal(audienceIncludes("round:Tech 1", app("in_process", { rounds: [{ name: "Tech 1", result: "cleared" }] })), true);
    assert.equal(audienceIncludes("round:Tech 1", app("in_process", { rounds: [{ name: "Tech 1", result: "rejected" }] })), false);
    assert.equal(audienceIncludes("round:Tech 1", app("in_process", { currentRound: "Tech 1" })), true);
    assert.equal(audienceIncludes("round:HR", app("in_process", { currentRound: "Tech 1" })), false);
    assert.equal(audienceIncludes("batch:2027", base), true);
    assert.equal(audienceIncludes("batch:2028", base), false);
    assert.equal(audienceIncludes("whatever", base), false);
});

test("event validation: audience needs an internship, dates in order, link is http(s)", () => {
    assert.equal(eventSchema.safeParse({ title: "Hi there", audience: "applicants" }).success, false);
    assert.equal(eventSchema.safeParse({ title: "Hi there", audience: "round:Tech" }).success, false);
    assert.ok(eventSchema.safeParse({ title: "Hi there", audience: "batch:2027" }).success);
    assert.ok(eventSchema.safeParse({ title: "Hi there", audience: "applicants", internshipId: String(id()) }).success);
    assert.equal(eventSchema.safeParse({ title: "Hi there", startsAt: "2030-01-02T10:00:00Z", endsAt: "2030-01-02T09:00:00Z" }).success, false);
    assert.equal(eventSchema.safeParse({ title: "Hi there", link: "javascript:alert(1)" }).success, false);
    assert.equal(eventSchema.safeParse({ title: "Hi", }).success, false);
    assert.equal(eventSchema.safeParse({ title: "Hi there", audience: "everyone" }).success, false);
});

test("event reaches exactly its audience: one email each, banned/other campus/opted-out excluded, in-app too", async () => {
    const e = await entity(), other = await entity();
    const [a, b, optedOut, banned, blacklisted] = [await student(e), await student(e), await student(e), await student(e), await student(e)];
    const outsider = await student(other);
    await setPreferences(optedOut, { emailUpdates: false });
    await User.updateOne({ _id: banned }, { $set: { isBanned: true } });
    await CampusBlacklist.create({ entityId: e._id, studentId: blacklisted, reason: "x", bannedBy: id() });

    const r = await createEvent(e, ev(), staff.id);
    assert.ok(r.ok && r.reach === 3); // a, b, optedOut (banned and blacklisted never get messages)
    const ev1 = r.ok ? r.event : null;
    const mails = await OutboundMessage.find({ kind: "event", refId: String(ev1!._id), channel: "email" }).lean();
    assert.deepEqual(mails.map((m) => m.recipientId).sort(), [a, b].sort()); // the opted-out student has no email, only the in-app notice
    assert.ok(mails.every((m) => m.entityId && String(m.entityId) === String(e._id)));
    for (const s of [a, b, optedOut]) assert.equal(await StudentNotification.countDocuments({ recipientId: s, type: "campus_event", title: /Pre-placement/ }), 1);
    for (const s of [outsider, banned, blacklisted]) assert.equal(await StudentNotification.countDocuments({ recipientId: s, type: "campus_event", title: /Pre-placement/ }), 0);
});

test("internship events: eligible / applicants / shortlisted / round audiences, and the feed colours", async () => {
    const e = await entity();
    const i = await internship(e, { eligibility: { minCgpa: 7 } });
    const applicant = await student(e), shortlisted = await student(e), eligibleNoApply = await student(e), inel = await student(e, { cgpa: 5 });
    await apply(applicant, i);
    const sApp = await apply(shortlisted, i);
    await changeCampusStatus(e, sApp.applicationId, "shortlisted", staff as never);
    await setRoundResult(e, sApp.applicationId, { name: "Tech 1", result: "cleared" });

    const reach = async (audience: string) => (await audienceRecipients(e._id, { audience, internshipId: i._id })).map((r) => r.id).sort();
    assert.deepEqual(await reach("applicants"), [applicant, shortlisted].sort());
    assert.deepEqual(await reach("shortlisted"), [shortlisted]);
    assert.deepEqual(await reach("round:Tech 1"), [shortlisted]);
    assert.deepEqual(await reach("eligible"), [applicant, shortlisted, eligibleNoApply].sort());
    assert.equal((await reach("all_members")).length, 4);

    const created = await createEvent(e, ev({ title: "Interview day", internshipId: String(i._id), audience: "all_members" }), staff.id);
    assert.ok(created.ok);
    const campusWide = await createEvent(e, ev({ title: "Campus notice" }), staff.id);
    assert.ok(campusWide.ok);
    const tagOf = async (u: string) => Object.fromEntries((await homeFeed(u))!.map((f) => [f.title, f.tag]));
    assert.deepEqual(await tagOf(applicant), { "Interview day": "applied", "Campus notice": null });
    assert.deepEqual(await tagOf(eligibleNoApply), { "Interview day": "open", "Campus notice": null });
    assert.deepEqual(await tagOf(inel), { "Interview day": "muted", "Campus notice": null });

    // an applicants-only event is invisible to non-applicants, in the feed and for the calendar file
    const only = await createEvent(e, ev({ title: "Applicants only", internshipId: String(i._id), audience: "applicants" }), staff.id);
    assert.ok(only.ok);
    assert.ok((await homeFeed(applicant))!.some((f) => f.title === "Applicants only"));
    assert.ok(!(await homeFeed(eligibleNoApply))!.some((f) => f.title === "Applicants only"));
    if (only.ok) {
        assert.ok(await eventForStudent(applicant, String(only.event._id)));
        assert.equal(await eventForStudent(eligibleNoApply, String(only.event._id)), null);
    }
    // another campus's event ids are invisible
    const e2 = await entity();
    const s2 = await student(e2);
    if (created.ok) assert.equal(await eventForStudent(s2, String(created.event._id)), null);
    // an internship of another campus cannot be attached
    const foreign = await createEvent(e2, ev({ internshipId: String(i._id) }), staff.id);
    assert.ok(!foreign.ok && foreign.status === 404);
});

test("update: only time/venue/link/mode changes re-notify (with what changed); typos do not; cancel tells once", async () => {
    const e = await entity();
    const s = await student(e);
    const r = await createEvent(e, ev({ venue: "Hall A" }), staff.id);
    assert.ok(r.ok);
    if (!r.ok) return;
    const evId = String(r.event._id);
    const sent = () => OutboundMessage.countDocuments({ kind: "event", refId: evId, recipientId: s });
    assert.equal(await sent(), 1);

    const typo = await updateEvent(e, evId, ev({ venue: "Hall A", title: "Pre-placement talk (typo fixed)", body: "More detail", startsAt: r.event.startsAt!.toISOString() }));
    assert.ok(typo.ok && !typo.notified);
    assert.equal(await sent(), 1);

    const moved = await updateEvent(e, evId, ev({ venue: "Hall B", startsAt: new Date(Date.now() + 4 * day).toISOString() }));
    assert.ok(moved.ok && moved.notified && moved.event.version === 2);
    assert.equal(await sent(), 2); // new version = new idempotency key = a new message
    const msg = await OutboundMessage.findOne({ refId: evId, recipientId: s, idempotencyKey: { $regex: ":2$" } }).lean();
    assert.match(msg!.text, /Changed: time, venue/);

    const c = await cancelEvent(e, evId);
    assert.ok(c.ok);
    assert.equal(await sent(), 3);
    assert.ok(!(await cancelEvent(e, evId)).ok); // already cancelled
    assert.equal(await sent(), 3);
    assert.ok(!(await updateEvent(e, evId, ev())).ok); // cancelled events are frozen
    assert.equal((await homeFeed(s))!.find((f) => f.title.startsWith("Pre-placement"))!.status, "cancelled");
    assert.deepEqual(materialChanges({ startsAt: null, endsAt: null, deadlineAt: null, venue: "A", link: null, mode: "online" } as never, { startsAt: null, endsAt: null, deadlineAt: null, venue: "A", link: null, mode: "online" } as never), []);
});

test("delete: only unannounced events (announced ones are cancelled)", async () => {
    const e = await entity();
    const r = await createEvent(e, ev(), staff.id);
    assert.ok(r.ok);
    if (!r.ok) return;
    const d = await deleteEvent(e._id, String(r.event._id));
    assert.ok(!d.ok && d.code === "announced");
    const quiet = await CampusEvent.create({ entityId: e._id, createdBy: staff.id, title: "Draft thing" });
    assert.ok((await deleteEvent(e._id, String(quiet._id))).ok);
    assert.ok(!(await deleteEvent(e._id, String(quiet._id))).ok);
    const other = await entity();
    assert.ok(!(await deleteEvent(other._id, String(r.event._id))).ok); // not their campus
});

test("publishing announces to eligible students exactly once", async () => {
    const e = await entity();
    const i = await internship(e, { eligibility: { minCgpa: 7 }, emailedAt: null });
    const [ok1, ok2, inel] = [await student(e), await student(e), await student(e, { cgpa: 5 })];
    assert.equal(await announceInternship(e, i), 2);
    assert.equal(await announceInternship(e, i), 0); // second click / second coordinator
    assert.equal((await CampusInternship.findById(i._id).lean())!.emailedAt instanceof Date, true);
    const mails = await OutboundMessage.find({ kind: "internship", refId: String(i._id) }).lean();
    assert.deepEqual(mails.map((m) => m.recipientId).sort(), [ok1, ok2].sort());
    assert.ok(mails.every((m) => !m.to.includes(",")));
    assert.equal(await StudentNotification.countDocuments({ recipientId: inel, type: "campus_internship" }), 0);
    assert.equal(await StudentNotification.countDocuments({ recipientId: ok1, type: "campus_internship" }), 1);
});

test("reminders: 24h events and closing internships, once only, right people", async () => {
    const e = await entity();
    const soonInternship = await internship(e, { deadlineDate: new Date(Date.now() + 10 * 3_600_000) });
    const farInternship = await internship(e, { deadlineDate: new Date(Date.now() + 3 * day) });
    const [applied, waiting] = [await student(e), await student(e)];
    await apply(applied, soonInternship);
    const soon = await createEvent(e, ev({ title: "Tomorrow's test", startsAt: new Date(Date.now() + 20 * 3_600_000).toISOString() }), staff.id);
    const far = await createEvent(e, ev({ title: "Next week", startsAt: new Date(Date.now() + 6 * day).toISOString() }), staff.id);
    assert.ok(soon.ok && far.ok);

    const first = await sendReminders();
    assert.equal(first.events >= 1 && first.deadlines >= 1, true);
    const evMails = await OutboundMessage.find({ kind: "event-reminder", refId: String(soon.ok && soon.event._id) }).lean();
    assert.deepEqual(evMails.map((m) => m.recipientId).sort(), [applied, waiting].sort());
    assert.equal(await OutboundMessage.countDocuments({ kind: "event-reminder", refId: String(far.ok && far.event._id) }), 0);
    const dl = await OutboundMessage.find({ kind: "deadline-reminder", refId: String(soonInternship._id) }).lean();
    assert.deepEqual(dl.map((m) => m.recipientId), [waiting]); // the one who applied is not nagged
    assert.equal(await OutboundMessage.countDocuments({ kind: "deadline-reminder", refId: String(farInternship._id) }), 0);

    const second = await sendReminders();
    assert.deepEqual([second.events, second.deadlines], [0, 0]); // idempotent
});

test("preferences: sms needs a phone; opting out of email stops mail but not the in-app notice", async () => {
    const e = await entity();
    const noPhone = await student(e), withPhone = await student(e, { phone: "+919999999999" });
    const bad = await setPreferences(noPhone, { smsUpdates: true });
    assert.ok(!bad.ok && bad.code === "phone_required");
    const ok = await setPreferences(withPhone, { smsUpdates: true, emailUpdates: false });
    assert.ok(ok.ok && ok.smsUpdates && !ok.emailUpdates);
    assert.ok(!(await setPreferences(String(id()), { emailUpdates: false })).ok);
});

test("ICS: valid shape, escaped text, folded lines, cancelled status", () => {
    const ics = buildIcs({ id: "abc", title: "Round 1; HR, \"final\"\nINJECT:evil", body: "Line1\nLine2", startsAt: new Date("2030-05-01T04:30:00Z"), venue: "Hall, 2nd floor", link: "https://x.test/a", sequence: 2 }, new Date("2030-01-01T00:00:00Z"));
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
    assert.ok(ics.includes("DTSTART:20300501T043000Z") && ics.includes("DTEND:20300501T053000Z"));
    assert.ok(ics.includes("SUMMARY:Round 1\\; HR\\, \"final\"\\nINJECT:evil"), "newline escaped, not a new property");
    assert.ok(!/^INJECT/m.test(ics));
    assert.ok(ics.includes("LOCATION:Hall\\, 2nd floor") && ics.includes("SEQUENCE:2") && ics.includes("STATUS:CONFIRMED"));
    assert.ok(buildIcs({ id: "x", title: "t", startsAt: new Date(), cancelled: true }).includes("STATUS:CANCELLED"));
    assert.ok(!buildIcs({ id: "x", title: "t", startsAt: new Date(), link: "javascript:alert(1)" }).includes("URL:"));
    const long = fold("DESCRIPTION:" + "é".repeat(100));
    for (const line of long.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `${Buffer.byteLength(line)} bytes`);
    assert.equal(long.replace(/\r\n /g, ""), "DESCRIPTION:" + "é".repeat(100)); // unfolding restores it
});
