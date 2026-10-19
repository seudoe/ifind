import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import BanEvent from "@/models/BanEvent";
import User from "@/models/User";
import { getUserSignals } from "@/lib/usage/signals";

export const runtime = "nodejs";

/** GET /api/moderator/users/:id/signals: usage, login and behaviour numbers plus ban history for one student. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getModSession();
    if (!session || !session.isVerified) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    await connectDB();
    const [signals, user, history] = await Promise.all([
      getUserSignals(id),
      User.findById(id, { name: 1, username: 1, email: 1, isBanned: 1, bannedReason: 1, bannedAt: 1 }).lean(),
      BanEvent.find({ userId: id }).sort({ at: -1 }).limit(50).lean(),
    ]);
    if (!signals || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { user, signals, banHistory: history } });
  } catch (error) {
    console.error("[moderator/users/[id]/signals GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
