import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { parseResumeWithAI } from "@/lib/resumeParser";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user || !user.resume?.driveViewLink) {
      return NextResponse.json({ success: false, error: "No active resume to re-extract" }, { status: 400 });
    }

    // Fetch PDF from ImageKit URL
    const pdfResponse = await fetch(user.resume.driveViewLink);
    if (!pdfResponse.ok) {
      return NextResponse.json({ success: false, error: "Unable to download current resume from ImageKit" }, { status: 500 });
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const parsedData = await parseResumeWithAI(pdfBuffer);

    user.resume.parsedData = parsedData;
    await user.save();

    // Trigger vectorization & recommendation scoring in background
    if (parsedData) {
      const { vectorizeAndRecommendUser } = await import("@/lib/vectorizer");
      void vectorizeAndRecommendUser(session.userId, parsedData);
    }


    return NextResponse.json({
      success: true,
      message: "Resume re-extracted successfully",
      data: parsedData,
    });
  } catch (err) {
    console.error("[resume/reextract POST]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Re-extraction failed" },
      { status: 500 }
    );
  }
}
