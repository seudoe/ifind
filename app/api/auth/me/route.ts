import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    await connectDB();
    const user = await User.findById(session.userId).select("-password").lean();
    if (!user) return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: JSON.parse(JSON.stringify(user)) });
  } catch (error) {
    console.error("[auth/me]", error);
    return NextResponse.json({ success: false, error: "Unable to load student" }, { status: 500 });
  }
}
