import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { withdrawApplication } from "@/lib/student-applications";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ internshipId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    const { internshipId } = await params;
    if (!mongoose.isValidObjectId(internshipId)) return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    await connectDB();
    const result = await withdrawApplication(session.userId, internshipId);
    return result.ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ success: false, error: result.error }, { status: result.status });
  } catch (error) {
    console.error("[user/applications/withdraw]", error);
    return NextResponse.json({ success: false, error: "Unable to withdraw" }, { status: 500 });
  }
}
