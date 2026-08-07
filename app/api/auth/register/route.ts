import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookie, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;

    if (!name || !username || !email || !password) {
      return NextResponse.json({ success: false, error: "Name, username, email, and password are required" }, { status: 400 });
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ success: false, error: "Username must be 3–20 lowercase letters, numbers, or underscores" }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 });
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters and include an uppercase letter and number" }, { status: 400 });
    }

    await connectDB();
    const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
    if (existing) {
      if (existing.email === email && existing.linkedinId) {
        return NextResponse.json(
          { success: false, error: "This email is already registered using LinkedIn. Please sign in with LinkedIn." },
          { status: 409 }
        );
      }
      const field = existing.email === email ? "email" : "username";
      return NextResponse.json({ success: false, error: `This ${field} is already taken` }, { status: 409 });
    }

    const user = await User.create({
      name,
      username,
      email,
      password: await bcrypt.hash(password, 12),
      profilePicture: null,
      role: "student",
      phone: null,
      dateOfBirth: null,
      gender: null,
      city: city || null,
      state: null,
      country: null,
      skills: [],
      resume: {
        driveFileId: null,
        driveViewLink: null,
        uploadedAt: null,
        parsedData: null,
        tfidf_vector: null,
        bert_vector: null,
        pendingFileId: null,
        pendingViewLink: null,
        pendingParsedData: null,
      },
      appliedInternships: [],
      savedInternships: [],
      recommendedInternships: {
        updatedAt: null,
        recommendedList: [],
        recommendedScores: [],
      },
      deleteDetails: {
        deleted: false,
        deletedAt: null,
      },
      profileCompletionScore: 20,
    });
    const session = { userId: user.id, email: user.email, username: user.username, role: "student" as const };
    const cookie = authCookie(signToken(session));
    const response = NextResponse.json({ success: true, message: "Account created", data: { username: user.username } }, { status: 201 });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      return NextResponse.json({ success: false, error: "Email or username is already taken" }, { status: 409 });
    }
    console.error("[auth/register]", error);
    return NextResponse.json({ success: false, error: "Unable to create account" }, { status: 500 });
  }
}
