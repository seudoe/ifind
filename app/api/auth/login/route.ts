import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { authCookie, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const identifier =
            typeof body.identifier === "string"
                ? body.identifier.trim().toLowerCase()
                : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!identifier || !password) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Email or username and password are required",
                },
                { status: 400 },
            );
        }

        await connectDB();
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }],
        }).select("+password");
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Invalid credentials" },
                { status: 401 },
            );
        }

        if (!user.password && user.linkedinId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "This account was created using LinkedIn. Please sign in with LinkedIn.",
                },
                { status: 400 },
            );
        }

        if (
            !user.password ||
            !(await bcrypt.compare(password, user.password))
        ) {
            return NextResponse.json(
                { success: false, error: "Invalid credentials" },
                { status: 401 },
            );
        }

        if (user.isBanned === true) {
            return NextResponse.json(
                { success: false, error: "Your account has been suspended" },
                { status: 403 },
            );
        }

        const session = {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: "student" as const,
        };
        const cookie = authCookie(signToken(session));
        const response = NextResponse.json({
            success: true,
            message: "Logged in",
            data: { username: user.username },
        });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
    } catch (error) {
        console.error("[auth/login]", error);
        return NextResponse.json(
            { success: false, error: "Unable to sign in" },
            { status: 500 },
        );
    }
}
