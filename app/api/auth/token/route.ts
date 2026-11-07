import { NextResponse } from "next/server";
import { getSession, signToken } from "@/lib/auth";
import { getEmpSession, signEmpToken } from "@/lib/employerAuth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

/**
 * Returns the current authenticated session and JWT bearer token.
 * Used by native mobile apps to synchronize and persist their authentication
 * credentials into device flash storage (localStorage).
 */
export async function GET(request: Request) {
  try {
    // 1. Check student session (from Bearer header or cookie)
    const studentSession = await getSession(request);
    if (studentSession) {
      await connectDB();
      const user = await User.findById(studentSession.userId).select("tokenVersion username email").lean();
      const token = signToken(studentSession, (user as { tokenVersion?: number } | null)?.tokenVersion ?? 0);
      return NextResponse.json({
        success: true,
        role: "student",
        token,
        username: studentSession.username,
        userId: studentSession.userId,
      });
    }

    // 2. Check employer session (from Bearer header or cookie)
    const empSession = await getEmpSession(request);
    if (empSession) {
      await connectDB();
      const emp = await Employer.findById(empSession.employerId).select("tokenVersion name email").lean();
      const token = signEmpToken(empSession, (emp as { tokenVersion?: number } | null)?.tokenVersion ?? 0);
      return NextResponse.json({
        success: true,
        role: "employer",
        token,
        name: empSession.name,
        employerId: empSession.employerId,
      });
    }

    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  } catch (error) {
    console.error("[api/auth/token]", error);
    return NextResponse.json({ success: false, error: "Failed to issue token" }, { status: 500 });
  }
}
