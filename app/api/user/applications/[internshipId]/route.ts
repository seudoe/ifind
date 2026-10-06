import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { loadApplied } from "@/lib/student-applications";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ internshipId: string }> };

/** One application with its status timeline. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    const { internshipId } = await params;
    if (!mongoose.isValidObjectId(internshipId)) return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    await connectDB();
    const [item] = await loadApplied(session.userId, internshipId);
    if (!item) return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("[user/applications/[id] GET]", error);
    return NextResponse.json({ success: false, error: "Unable to load application" }, { status: 500 });
  }
}
