import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { toModeratorItem } from "@/lib/eventStore";
import EventModel, { type IEvent } from "@/models/Event";

export const runtime = "nodejs";

/** GET /api/moderator/events: every stored event, active ones first (closest deadline), then hidden and expired. */
export async function GET() {
  try {
    const session = await getModSession();
    if (!session || !session.isVerified) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectDB();
    const now = new Date();
    const rows = await EventModel.find({}).sort({ createdAt: -1 }).limit(300).lean<IEvent[]>();
    const items = rows.map((e) => toModeratorItem(e, now));
    const live = (e: (typeof items)[number]) => !e.hidden && !e.expired;
    items.sort((a, b) => Number(live(b)) - Number(live(a)) || Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
    return NextResponse.json({ success: true, data: { items } });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load events" }, { status: 500 });
  }
}
