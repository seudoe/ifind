import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
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

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: "Email and password are required" },
                { status: 400 },
            );
        }

        await connectDB();

        const moderator = await Moderator.findOne({ email }).select(
            "+password",
        );
        if (!moderator || !moderator.password) {
            return NextResponse.json(
                { success: false, error: "Invalid credentials" },
                { status: 401 },
            );
        }

        const passwordMatch = await bcrypt.compare(
            password,
            moderator.password,
        );
        if (!passwordMatch) {
            return NextResponse.json(
                { success: false, error: "Invalid credentials" },
                { status: 401 },
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
                username: moderator.email.split('@')[0],
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
