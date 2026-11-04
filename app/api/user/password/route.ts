import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookie, getSession, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { checkPassword, MAX_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwords";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import User from "@/models/User";

export const runtime = "nodejs";

const fail = (error: string, status = 400, code?: string) => NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });

/**
 * Change the password (needs the current one), or set a first password on a LinkedIn-only account.
 * Setting needs proof that the LinkedIn owner asked: GET /api/auth/linkedin?as=student-setpw leaves a 10-minute one-time
 * token (httpOnly cookie + hash on the user) that this route consumes.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = await hit("user-password", session.userId, RULES.sensitiveUser);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => null);
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (next.length > MAX_PASSWORD_LENGTH || current.length > MAX_PASSWORD_LENGTH) return fail("Password is too long");

  await connectDB();
  const user = await User.findById(session.userId).select("+password +passwordSetupTokenHash +passwordSetupExpiresAt");
  if (!user) return fail("Not authenticated", 401);

  const settingFirst = !user.password;
  if (settingFirst) {
    const secret = request.cookies.get("pw_setup")?.value ?? "";
    const stored = user.passwordSetupTokenHash ?? "";
    const given = createHash("sha256").update(secret).digest("hex");
    const ok = Boolean(user.linkedinId) && Boolean(secret) && stored.length === given.length
      && timingSafeEqual(Buffer.from(stored), Buffer.from(given))
      && (user.passwordSetupExpiresAt?.getTime() ?? 0) > Date.now();
    if (!ok) return fail("Confirm with LinkedIn first to set a password.", 403, "linkedin_reauth_required");
  } else if (!(await checkPassword(current, user.password))) {
    return fail("Current password is incorrect");
  }

  const issue = await passwordProblem(next, { email: user.email, username: user.username, name: user.name });
  if (issue) return fail(issue);

  user.password = await bcrypt.hash(next, 12);
  user.passwordSetupTokenHash = null;
  user.passwordSetupExpiresAt = null;
  // Sessions issued before this moment stop working; this browser gets a fresh one
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  // Setting a first password just followed a LinkedIn sign-in, so the monthly clock starts here
  if (settingFirst) user.linkedinLastAuthAt = new Date();
  await user.save();

  const cookie = authCookie(signToken({ userId: user.id, email: user.email, username: user.username, role: "student" }, user.tokenVersion));
  const res = NextResponse.json({ success: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  res.cookies.delete({ name: "pw_setup", path: "/api/user/password" });
  return res;
}
