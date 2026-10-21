import { after, NextRequest, NextResponse } from "next/server";
import { sendServerEvent } from "@/lib/analytics/measurementProtocol";
import { authCookie, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { checkPassword, MAX_PASSWORD_LENGTH } from "@/lib/passwords";
import { limitAuth, RULES } from "@/lib/rateLimit";
import User from "@/models/User";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const INVALID_CREDENTIALS = "Invalid credentials. If you signed up with LinkedIn, use Continue with LinkedIn.";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!identifier || !password || identifier.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
            return NextResponse.json({ success: false, error: "Email or username and password are required" }, { status: 400 });
        }

        const limited = await limitAuth(request, "login", RULES.loginIp, { id: identifier, rule: RULES.loginAccount });
        if (limited) return limited;

        await connectDB();
        const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] }).select("+password");
        if (!user) {
            await checkPassword(password, null); // same cost as a real check, so timing doesn't reveal unknown accounts
            log.warn("auth/login", "sign-in rejected: unknown account");
            return NextResponse.json({ success: false, error: INVALID_CREDENTIALS }, { status: 401 });
        }

        // Same response whether the account is unknown, LinkedIn-only, or the password is wrong:
        // a different message here would reveal which emails have accounts.
        if (!(await checkPassword(password, user.password))) {
            log.warn("auth/login", "sign-in rejected: wrong password", { username: user.username });
            // Keep the 20 most recent failures; the moderator panel counts the ones from the last 24 hours.
            await User.updateOne({ _id: user._id }, { $push: { failedLoginAttempts: { $each: [new Date()], $slice: -20 } } });
            return NextResponse.json({ success: false, error: INVALID_CREDENTIALS }, { status: 401 });
        }

        if (user.isBanned === true) {
            log.warn("auth/login", "sign-in rejected: account suspended", { username: user.username });
            return NextResponse.json({ success: false, error: "Your account has been suspended" }, { status: 403 });
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

        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } });

        const session = { userId: user.id, email: user.email, username: user.username, role: "student" as const };
        const cookie = authCookie(signToken(session));
        const response = NextResponse.json({
            success: true,
            message: loginNotice || "Logged in",
            notice: loginNotice,
            data: { username: user.username },
        });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        log.ok("auth/login", "user signed in", { username: user.username, role: "student", notice: loginNotice ? "account restored/reset" : undefined });
        after(() => sendServerEvent(request, "login", { user_type: "student" }));
        return response;
    } catch (error) {
        console.error("[auth/login]", error);
        return NextResponse.json({ success: false, error: "Unable to sign in" }, { status: 500 });
    }
}
