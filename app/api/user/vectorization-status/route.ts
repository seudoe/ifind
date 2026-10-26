import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId).select("vectorizationStatus updatedAt");
    
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // A run that never reported back (function killed, vectoriser down) must not show "processing" forever
    let status = user.vectorizationStatus || "idle";
    const started = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
    if (status === "processing" && started && Date.now() - started > 5 * 60_000) {
      status = "failed";
      await User.updateOne({ _id: session.userId, vectorizationStatus: "processing" }, { $set: { vectorizationStatus: "failed" } }, { timestamps: false });
    }

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("[user/vectorization-status GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
