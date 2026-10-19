/**
 * Events (hackathons and contests): closing labels, filters and sort order, and the query behind the student page.
 * Run with: npm run test:events  (the query tests start an in-memory MongoDB)
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { closingLabel, daysUntilClose, eventDates, filterEvents, formatDay, NO_FILTERS, sortEvents, type EventItem } from "../lib/events";

// The bot stores the end of the deadline day in IST: 25 Oct 2026 -> 2026-10-25T18:30:00Z.
const DEADLINE_25_OCT = "2026-10-25T18:30:00.000Z";

describe("closing label", () => {
  const e = (expiresAt: string, datesKnown = true) => ({ expiresAt, datesKnown });

  it("counts the deadline day in full, in IST", () => {
    assert.equal(daysUntilClose(DEADLINE_25_OCT, new Date("2026-10-25T18:29:59Z")), 0);      // 23:59:59 IST on the 25th
    assert.equal(daysUntilClose(DEADLINE_25_OCT, new Date("2026-10-25T00:00:00Z")), 0);
    assert.equal(daysUntilClose(DEADLINE_25_OCT, new Date("2026-10-24T18:30:00Z")), 0);      // 00:00 IST on the 25th
    assert.equal(daysUntilClose(DEADLINE_25_OCT, new Date("2026-10-24T18:29:59Z")), 1);      // 23:59:59 IST on the 24th
  });

  it("reads 'today', 'tomorrow' and 'in N days' with red, amber and neutral tones", () => {
    assert.deepEqual(closingLabel(e(DEADLINE_25_OCT), new Date("2026-10-25T05:00:00Z")), { text: "Closes today", tone: "red" });
    assert.deepEqual(closingLabel(e(DEADLINE_25_OCT), new Date("2026-10-24T05:00:00Z")), { text: "Closes tomorrow", tone: "red" });
    assert.deepEqual(closingLabel(e(DEADLINE_25_OCT), new Date("2026-10-22T05:00:00Z")), { text: "Closes in 3 days", tone: "amber" });
    assert.deepEqual(closingLabel(e(DEADLINE_25_OCT), new Date("2026-10-19T05:00:00Z")), { text: "Closes in 6 days", tone: "neutral" });
  });

  it("says so when no date was found", () => {
    assert.deepEqual(closingLabel(e("2026-11-18T06:00:00.000Z", false)), { text: "Dates not announced", tone: "neutral" });
  });
});

describe("dates", () => {
  it("formats day strings without shifting them across time zones", () => {
    assert.equal(formatDay("2026-10-31"), "31 Oct 2026");
    assert.equal(formatDay(null), "");
  });

  it("shows a range only when the event spans days", () => {
    assert.equal(eventDates({ startDate: "2026-10-31", endDate: "2026-10-31" }), "31 Oct 2026");
    assert.equal(eventDates({ startDate: "2026-10-30", endDate: "2026-11-01" }), "30 Oct 2026 to 1 Nov 2026");
    assert.equal(eventDates({ startDate: null, endDate: null }), "");
  });
});

const item = (over: Partial<EventItem>): EventItem => ({
  id: "x", title: "T", organiser: null, type: "hackathon", mode: null, location: null, startDate: null, endDate: null,
  registrationDeadline: null, datesKnown: true, expiresAt: DEADLINE_25_OCT, link: "https://x.example", summary: null, perks: [],
  hiring: false, eligibility: null, note: null, imageUrl: null, createdAt: "2026-10-01T00:00:00.000Z", ...over,
});

describe("sort and filter", () => {
  it("puts the closest deadline first and undated events last, newest first", () => {
    const sorted = sortEvents([
      item({ id: "undated-old", datesKnown: false, createdAt: "2026-10-01T00:00:00.000Z", expiresAt: "2026-10-31T00:00:00.000Z" }),
      item({ id: "later", expiresAt: "2026-11-05T18:30:00.000Z" }),
      item({ id: "undated-new", datesKnown: false, createdAt: "2026-10-10T00:00:00.000Z", expiresAt: "2026-11-09T00:00:00.000Z" }),
      item({ id: "soon", expiresAt: "2026-10-22T18:30:00.000Z" }),
    ]);
    assert.deepEqual(sorted.map((e) => e.id), ["soon", "later", "undated-new", "undated-old"]);
  });

  it("filters by type, mode and hiring", () => {
    const all = [
      item({ id: "a", type: "hackathon", mode: "offline", hiring: true }),
      item({ id: "b", type: "contest", mode: "online" }),
      item({ id: "c", type: "contest", mode: "hybrid", hiring: true }),
      item({ id: "d", type: "challenge", mode: null }),
    ];
    const ids = (f: Partial<typeof NO_FILTERS>) => filterEvents(all, { ...NO_FILTERS, ...f }).map((e) => e.id);
    assert.deepEqual(ids({}), ["a", "b", "c", "d"]);
    assert.deepEqual(ids({ type: "contest" }), ["b", "c"]);
    assert.deepEqual(ids({ mode: "online" }), ["b"]);
    assert.deepEqual(ids({ mode: "in-person" }), ["a", "c"]);
    assert.deepEqual(ids({ hiringOnly: true }), ["a", "c"]);
    assert.deepEqual(ids({ type: "contest", hiringOnly: true }), ["c"]);
  });
});

describe("active events query", () => {
  let stop: (() => Promise<void>) | null = null;
  let skip: string | null = null;

  before(async () => {
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const server = await MongoMemoryServer.create();
      process.env.MONGODB_URI = server.getUri("events_test");
      const mongoose = (await import("mongoose")).default;
      await (await import("../lib/db")).connectDB();
      stop = async () => {
        await mongoose.disconnect();
        await server.stop();
      };
    } catch (err) {
      skip = `in-memory MongoDB unavailable (${err instanceof Error ? err.message : err})`;
    }
  });

  after(async () => {
    await stop?.();
  });

  it("shows live events only, nearest deadline first, undated last", async (t) => {
    if (skip) return t.skip(skip);
    const { default: EventModel } = await import("../models/Event");
    const { listActiveEvents } = await import("../lib/eventStore");
    await EventModel.deleteMany({});

    const base = { link: "https://x.example", type: "hackathon" as const, perks: [], hidden: false };
    await EventModel.create([
      { ...base, title: "Later", datesKnown: true, expiresAt: new Date("2026-11-05T18:30:00Z") },
      { ...base, title: "Soon", datesKnown: true, expiresAt: new Date(DEADLINE_25_OCT) },
      { ...base, title: "Undated", datesKnown: false, expiresAt: new Date("2026-11-10T00:00:00Z") },
      { ...base, title: "Hidden by a moderator", datesKnown: true, expiresAt: new Date("2026-11-01T18:30:00Z"), hidden: true },
      { ...base, title: "Over", datesKnown: true, expiresAt: new Date("2026-10-18T18:30:00Z") },
    ]);

    const titles = async (now: string) => (await listActiveEvents(new Date(now))).map((e) => e.title);
    assert.deepEqual(await titles("2026-10-19T06:00:00Z"), ["Soon", "Later", "Undated"]);
    // The deadline day stays open until its last second in IST, then the event drops out.
    assert.ok((await titles("2026-10-25T18:29:59Z")).includes("Soon"));
    assert.ok(!(await titles("2026-10-25T18:30:00Z")).includes("Soon"));
  });

  it("reads events the way the bot writes them (plain documents with date strings, no Mongoose defaults)", async (t) => {
    if (skip) return t.skip(skip);
    const mongoose = (await import("mongoose")).default;
    const { listActiveEvents } = await import("../lib/eventStore");
    await mongoose.connection.collection("events").deleteMany({});
    await mongoose.connection.collection("events").insertOne({
      title: "Paytm Build for India", organiser: "Paytm", type: "hackathon", mode: "offline", location: "Mumbai",
      startDate: "2026-10-31", endDate: "2026-10-31", registrationDeadline: "2026-10-25", datesKnown: true,
      expiresAt: new Date(DEADLINE_25_OCT), link: "https://devsemble.com/h", summary: "8 hours", perks: ["Hiring opportunity with Paytm"],
      hiring: true, eligibility: null, note: "Teams of 2-4", imageUrl: null, hidden: false, source: "telegram",
      createdAt: new Date("2026-10-19T06:00:00Z"), updatedAt: new Date("2026-10-19T06:00:00Z"),
    });
    const [e] = await listActiveEvents(new Date("2026-10-19T06:00:00Z"));
    assert.equal(e.title, "Paytm Build for India");
    assert.equal(e.registrationDeadline, "2026-10-25");
    assert.equal(e.hiring, true);
    assert.equal(e.note, "Teams of 2-4");
    assert.equal(e.expiresAt, DEADLINE_25_OCT);
  });
});
