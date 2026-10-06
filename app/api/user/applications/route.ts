import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { loadApplied } from "@/lib/student-applications";

export const runtime = "nodejs";

/** The student's applied internships with their pipeline status (student-safe). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    await connectDB();
    const items = await loadApplied(session.userId);
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error("[user/applications GET]", error);
    return NextResponse.json({ success: false, error: "Unable to load applications" }, { status: 500 });
  }
}
