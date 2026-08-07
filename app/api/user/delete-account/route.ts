import { NextRequest, NextResponse } from "next/server";
import { getSession, authCookie } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const confirmUsername = typeof body.confirmUsername === "string" ? body.confirmUsername.trim() : "";

    if (!confirmUsername || confirmUsername.toLowerCase() !== session.username.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Username does not match. Account deletion cancelled." },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    user.deleteDetails = {
      deleted: true,
      deletedAt: new Date(),
    };
    await user.save();

    const response = NextResponse.json({
      success: true,
      message: "Account scheduled for deletion. You can retrieve your account within 30 days by logging in normally.",
    });

    // Clear session auth cookie to log user out
    const expiredCookie = authCookie("");
    response.cookies.set(expiredCookie.name, "", {
      ...expiredCookie.options,
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("[delete-account POST]", err);
    return NextResponse.json(
      { success: false, error: "Failed to schedule account deletion" },
      { status: 500 }
    );
  }
}
