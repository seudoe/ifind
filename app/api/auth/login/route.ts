import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookie, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: "Email or username and password are required" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select("+password");
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.password && user.linkedinId) {
      return NextResponse.json(
        { success: false, error: "This account was created using LinkedIn. Please sign in with LinkedIn." },
        { status: 400 }
      );
    }

    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    let loginNotice: string | null = null;
    if (user.deleteDetails && user.deleteDetails.deleted === true) {
      const deletedAtTime = user.deleteDetails.deletedAt
        ? new Date(user.deleteDetails.deletedAt).getTime()
        : Date.now();
      const daysPassed = (Date.now() - deletedAtTime) / (1000 * 60 * 60 * 24);

      if (daysPassed > 30) {
        // > 30 days: Reset account data completely
        user.profilePicture = null;
        user.phone = null;
        user.dateOfBirth = null;
        user.gender = null;
        user.city = null;
        user.state = null;
        user.country = null;
        user.skills = [];
        user.resume = {
          driveFileId: null,
          driveViewLink: null,
          uploadedAt: null,
          parsedData: null,
          tfidf_vector: null,
          bert_vector: null,
          pendingFileId: null,
          pendingViewLink: null,
          pendingParsedData: null,
        };
        user.appliedInternships = [];
        user.savedInternships = [];
        user.recommendedInternships = {
          updatedAt: null,
          recommendedList: [],
          recommendedScores: [],
        };
        user.profileCompletionScore = 20;
        user.deleteDetails = {
          deleted: false,
          deletedAt: null,
        };
        await user.save();
        loginNotice = "Your account data expired after 30 days and was reset.";
      } else {
        // <= 30 days: Restore account & cancel deletion
        user.deleteDetails = {
          deleted: false,
          deletedAt: null,
        };
        await user.save();
        loginNotice = "Welcome back! Your account deletion was cancelled and your profile has been restored.";
      }
    }

    const session = { userId: user.id, email: user.email, username: user.username, role: "student" as const };
    const cookie = authCookie(signToken(session));
    const response = NextResponse.json({
      success: true,
      message: loginNotice || "Logged in",
      notice: loginNotice,
      data: { username: user.username },
    });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    console.error("[auth/login]", error);
    const message = error instanceof Error ? error.message : "Unable to sign in";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
