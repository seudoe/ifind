import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { modAuthCookie, signModToken } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!name || !email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Name, email, and password are required",
                },
                { status: 400 },
            );
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json(
                { success: false, error: "A valid email is required" },
                { status: 400 },
            );
        }

        if (
            password.length < 8 ||
            !/[A-Z]/.test(password) ||
            !/[0-9]/.test(password)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Password must be 8+ chars, 1 uppercase, 1 number",
                },
                { status: 400 },
            );
        }

        await connectDB();

        const existing = await Moderator.findOne({ email }).lean();
        if (existing) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Email already registered as moderator",
                },
                { status: 409 },
            );
        }

        const hash = await bcrypt.hash(password, 12);
        const doc = await Moderator.create({
            name,
            email,
            password: hash,
            isVerified: false,
            role: "moderator",
        });

        const token = signModToken({
            moderatorId: doc._id.toString(),
            email: doc.email,
            name: doc.name,
            role: "moderator",
            isVerified: false,
        });

        const cookie = modAuthCookie(token);
        const response = NextResponse.json(
            { success: true, data: { moderatorId: doc._id.toString() } },
            { status: 201 },
        );
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
    } catch (error) {
        if (
            typeof error === "object" &&
            error &&
            "code" in error &&
            error.code === 11000
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Email already registered as moderator",
                },
                { status: 409 },
            );
        }
        console.error("[moderator/auth/register]", error);
        return NextResponse.json(
            { success: false, error: "Unable to create moderator account" },
            { status: 500 },
        );
    }
}
