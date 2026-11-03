import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { loadCampusApplied } from "@/lib/campus/studentApplications";
import { loadApplied } from "@/lib/student-applications";

export const runtime = "nodejs";

/** The student's applied internships with their pipeline status (student-safe), plus their campus applications. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    await connectDB();
    const [items, campus] = await Promise.all([loadApplied(session.userId), loadCampusApplied(session.userId)]);
    // `campus` is a separate list on purpose: campus applications have their own statuses and live in their own collection
    return NextResponse.json({ success: true, data: { items, campus } });
  } catch (error) {
    console.error("[user/applications GET]", error);
    return NextResponse.json({ success: false, error: "Unable to load applications" }, { status: 500 });
  }
}
