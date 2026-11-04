import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { notify } from "@/lib/employer/notify";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { empAuthCookie, signEmpToken } from "@/lib/employerAuth";
import { checkPassword, passwordProblem } from "@/lib/passwords";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

/** Change password, or set one for a LinkedIn-only account (no currentPassword needed then). */
export async function POST(request: NextRequest) {
    try {
        const auth = await requireEmployer();
        if (isResponse(auth)) return auth;

        // Changing a password needs the current one, so it is a password-guessing oracle: limit it per employer.
        const rl = await hit("emp-password", String(auth._id), RULES.sensitiveUser);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const body = await request.json();
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
        if (newPassword.length > 128 || currentPassword.length > 128) {
            return NextResponse.json({ success: false, error: "Password is too long" }, { status: 400 });
        }
        const passwordIssue = await passwordProblem(newPassword, { email: auth.email, name: auth.name });
        if (passwordIssue) {
            return NextResponse.json({ success: false, error: passwordIssue }, { status: 400 });
        }

        await connectDB();
        const employer = await Employer.findById(auth._id).select("+password +passwordSetupTokenHash +passwordSetupExpiresAt");
        if (!employer) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        const settingFirst = !employer.password;
        if (settingFirst) {
            const secret = request.cookies.get("pw_setup")?.value ?? "";
            const stored = employer.passwordSetupTokenHash ?? "";
            const given = createHash("sha256").update(secret).digest("hex");
            const ok = Boolean(employer.linkedinId) && Boolean(secret) && stored.length === given.length
                && timingSafeEqual(Buffer.from(stored), Buffer.from(given))
                && (employer.passwordSetupExpiresAt?.getTime() ?? 0) > Date.now();
            if (!ok) return NextResponse.json({ success: false, error: "Confirm with LinkedIn first to set a password.", code: "linkedin_reauth_required" }, { status: 403 });
        } else if (!(await checkPassword(currentPassword, employer.password))) {
            return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
        }
        employer.password = await bcrypt.hash(newPassword, 12);
        // Every token issued before this moment (including a thief's) stops working; this browser gets a fresh one.
        employer.tokenVersion = (employer.tokenVersion ?? 0) + 1;
        employer.passwordSetupTokenHash = null;
        employer.passwordSetupExpiresAt = null;
        if (settingFirst) employer.linkedinLastAuthAt = new Date();
        await employer.save();
        await notify({
            recipientType: "employer",
            recipientIds: [employer._id],
            type: "account_security",
            title: settingFirst ? "Password was set for your account" : "Your password was changed",
            body: "All other devices were signed out. If this wasn't you, contact support right away.",
            link: "/employer/settings",
        });
        const cookie = empAuthCookie(signEmpToken({ employerId: employer.id, email: employer.email, name: employer.name, role: "employer" }, employer.tokenVersion));
        const response = NextResponse.json({ success: true });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        response.cookies.delete({ name: "pw_setup", path: "/api/employer/account/password" });
        return response;
    } catch (error) {
        console.error("[employer/account/password]", error);
        return NextResponse.json({ success: false, error: "Unable to update password" }, { status: 500 });
    }
}
