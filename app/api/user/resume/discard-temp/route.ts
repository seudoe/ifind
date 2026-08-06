import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { deleteResumeFromImageKit } from "@/lib/imagekit";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "Student user not found" }, { status: 404 });
    }

    const { pendingFileId } = user.resume || {};

    if (pendingFileId) {
      await deleteResumeFromImageKit(pendingFileId);
    }

    user.resume.pendingFileId = null;
    user.resume.pendingViewLink = null;
    user.resume.pendingParsedData = null;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Pending resume update discarded",
      data: user.resume,
    });
  } catch (err) {
    console.error("[resume/discard-temp POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Discard failed" },
      { status: 500 }
    );
  }
}
