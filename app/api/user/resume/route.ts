import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { deleteResumeFromImageKit } from "@/lib/imagekit";
import { calculateProfileScore } from "@/lib/profile/completion";

export const runtime = "nodejs";

export async function DELETE() {
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

    const { driveFileId, pendingFileId } = user.resume || {};

    if (driveFileId) {
      await deleteResumeFromImageKit(driveFileId);
    }
    if (pendingFileId) {
      await deleteResumeFromImageKit(pendingFileId);
    }

    user.resume = {
      driveFileId: null,
      driveViewLink: null,
      uploadedAt: null,
      parsedData: null,
      pendingFileId: null,
      pendingViewLink: null,
      pendingParsedData: null,
    };
    user.profileCompletionScore = calculateProfileScore(user.toObject ? user.toObject() : user);
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (err) {
    console.error("[resume DELETE]", err);
    return NextResponse.json(
      { success: false, error: "Delete failed" },
      { status: 500 }
    );
  }
}
