import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { checkPassword, MAX_PASSWORD_LENGTH } from "@/lib/passwords";
import { limitAuth, RULES } from "@/lib/rateLimit";
import { modAuthCookie, signModToken } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!email || !password || email.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
            return NextResponse.json(
                { success: false, error: "Email and password are required" },
                { status: 400 },
            );
        }

        // Moderator accounts are high value: tighter per-account limit than students.
        const limited = await limitAuth(request, "mod-login", RULES.loginIp, { id: email, rule: { limit: 5, windowSec: 15 * 60 } });
        if (limited) return limited;

        await connectDB();

        const moderator = await Moderator.findOne({ email }).select(
            "+password",
        );
        const passwordMatch = await checkPassword(password, moderator?.password);
        if (!moderator || !passwordMatch) {
            return NextResponse.json(
                { success: false, error: "Invalid credentials" },
                { status: 401 },
            );
        }

        if (moderator.isBanned) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Your moderator account has been suspended",
                },
                { status: 403 },
            );
        }

        const token = signModToken({
            moderatorId: moderator._id.toString(),
            email: moderator.email,
            name: moderator.name,
            role: "moderator",
            isVerified: moderator.isVerified,
        });

        const cookie = modAuthCookie(token);
        const response = NextResponse.json({
            success: true,
            data: {
                moderatorId: moderator._id.toString(),
                isVerified: moderator.isVerified,
                username: moderator.email.split("@")[0],
            },
        });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
    } catch (error) {
        console.error("[moderator/auth/login]", error);
        return NextResponse.json(
            { success: false, error: "Unable to sign in" },
            { status: 500 },
        );
    }
}
