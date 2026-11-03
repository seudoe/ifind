import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import { safeHref } from "@/lib/safeUrl";
import { str } from "@/lib/validate";
import User from "@/models/User";

export const runtime = "nodejs";

/** Closes the one-time "review your LinkedIn details" pop-up, optionally taking the name and photo from LinkedIn. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  const rl = await hit("profile-write", session.userId, RULES.profileWrite);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  await connectDB();
  const user = await User.findById(session.userId).select("linkedinId linkedinDetails linkedinReviewedAt");
  if (!user?.linkedinId) return NextResponse.json({ success: false, error: "LinkedIn is not connected" }, { status: 409 });

  const set: Record<string, unknown> = { linkedinReviewedAt: new Date() };
  if (body.name !== undefined) {
    const name = str(body.name, 100);
    if (!name) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    set.name = name;
  }
  if (body.useLinkedInPhoto === true) {
    const pic = safeHref(user.linkedinDetails?.picture);
    if (pic) set.profilePicture = pic;
  }
  await User.updateOne({ _id: user._id }, { $set: set });
  return NextResponse.json({ success: true });
}
