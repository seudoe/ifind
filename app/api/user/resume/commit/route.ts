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

    const { pendingFileId, pendingViewLink, pendingParsedData, driveFileId } = user.resume || {};

    if (!pendingFileId && !pendingParsedData) {
      return NextResponse.json({ success: false, error: "No pending resume upload to commit" }, { status: 400 });
    }

    // Deletes previous live file from ImageKit if replaced
    if (driveFileId && driveFileId !== pendingFileId) {
      await deleteResumeFromImageKit(driveFileId);
    }

    // Promote pending -> live
    user.resume.driveFileId = pendingFileId;
    user.resume.driveViewLink = pendingViewLink;
    user.resume.parsedData = pendingParsedData;
    user.resume.uploadedAt = new Date();

    // Clear pending fields
    user.resume.pendingFileId = null;
    user.resume.pendingViewLink = null;
    user.resume.pendingParsedData = null;

    user.profileCompletionScore = Math.min(100, (user.profileCompletionScore || 20) + 30);
    await user.save();

    // Trigger vectorization & recommendation scoring in background
    if (pendingParsedData) {
      const { vectorizeAndRecommendUser } = await import("@/lib/vectorizer");
      void vectorizeAndRecommendUser(session.userId, pendingParsedData);
    }


    return NextResponse.json({
      success: true,
      message: "Resume data applied successfully",
      data: user.resume,
    });
  } catch (err) {
    console.error("[resume/commit POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Commit failed" },
      { status: 500 }
    );
  }
}
