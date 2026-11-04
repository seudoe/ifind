import { NextResponse } from "next/server";
import { authCookie, getSession, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import User from "@/models/User";

export const runtime = "nodejs";

const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

/**
 * Finishes connecting LinkedIn to a signed-in account (the callback only stages it): links LinkedIn and, when LinkedIn
 * gave an email, replaces the account email with it. `{ cancel: true }` drops the staged connection instead.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = await hit("profile-write", session.userId, RULES.profileWrite);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  const body = await request.json().catch(() => ({}));

  await connectDB();
  const user = await User.findById(session.userId).select("+linkedinPending");
  if (!user) return fail("Not authenticated", 401);

  if (body?.cancel === true) {
    await User.updateOne({ _id: user._id }, { $set: { linkedinPending: null } });
    return NextResponse.json({ success: true });
  }

  const pending = user.linkedinPending;
  const profile = pending?.profile;
  if (!profile?.sub || !pending?.expiresAt || new Date(pending.expiresAt).getTime() < Date.now()) {
    await User.updateOne({ _id: user._id }, { $set: { linkedinPending: null } });
    return fail("This LinkedIn connection expired. Connect LinkedIn again.", 410);
  }
  if (user.linkedinId) return fail("LinkedIn is already connected", 409);

  const email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
  const set: Record<string, unknown> = {
    linkedinId: profile.sub, linkedinDetails: profile, linkedinLinkedAt: new Date(), linkedinLastAuthAt: new Date(), linkedinReviewedAt: null, linkedinPending: null,
    ...(pending.verification ? { linkedinVerification: pending.verification } : {}),
  };
  if (email && email !== user.email) set.email = email;
  try {
    // unique indexes on linkedinId and email settle any race with another account
    await User.updateOne({ _id: user._id }, { $set: set });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return fail("This LinkedIn account or its email is already used by another iFind account.", 409);
    throw e;
  }

  const cookie = authCookie(signToken({ userId: user.id, email: (set.email as string) ?? user.email, username: user.username, role: "student" }, user.tokenVersion ?? 0));
  const res = NextResponse.json({ success: true, data: { email: (set.email as string) ?? user.email } });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
