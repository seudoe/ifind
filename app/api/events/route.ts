import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listActiveEvents } from "@/lib/eventStore";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

/** GET /api/events: hackathons and contests still open, closest deadline first. Students only. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    return NextResponse.json({ success: true, data: { items: await listActiveEvents() } });
  } catch (error) {
    log.warn("events", "listing failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: "Failed to load events" }, { status: 500 });
  }
}
