import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import EventModel from "@/models/Event";

export const runtime = "nodejs";

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** PATCH { action: "hide" | "unhide" }: take an event off the student page, or put it back. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getModSession();
    if (!session || !session.isVerified) return fail("Forbidden", 403);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return fail("Invalid event id", 400);

    const body = await request.json().catch(() => ({}));
    if (body?.action !== "hide" && body?.action !== "unhide") return fail('Action must be "hide" or "unhide"', 400);

    await connectDB();
    const updated = await EventModel.findByIdAndUpdate(id, { $set: { hidden: body.action === "hide" } }, { new: true });
    if (!updated) return fail("Event not found", 404);
    return NextResponse.json({ success: true, data: { id, hidden: updated.hidden } });
  } catch {
    return fail("Failed to update the event", 500);
  }
}

/** DELETE: remove the event for good. (Sending the same EVENT message again would add it back.) */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getModSession();
    if (!session || !session.isVerified) return fail("Forbidden", 403);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return fail("Invalid event id", 400);

    await connectDB();
    const removed = await EventModel.findByIdAndDelete(id);
    if (!removed) return fail("Event not found", 404);
    return NextResponse.json({ success: true });
  } catch {
    return fail("Failed to delete the event", 500);
  }
}
