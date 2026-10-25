import bcrypt from "bcryptjs";
import { moderatorIds, notify } from "@/lib/employer/notify";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MAX_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwords";
import { limitAuth, RULES } from "@/lib/rateLimit";
import { modAuthCookie, signModToken } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const limited = await limitAuth(request, "mod-register", RULES.registerIp);
        if (limited) return limited;

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

        if (name.length > 100 || email.length > 254 || password.length > MAX_PASSWORD_LENGTH) {
            return NextResponse.json(
                { success: false, error: "One of the fields is too long" },
                { status: 400 },
            );
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json(
                { success: false, error: "A valid email is required" },
                { status: 400 },
            );
        }

        const passwordIssue = await passwordProblem(password, { email, name });
        if (passwordIssue) {
            return NextResponse.json(
                { success: false, error: passwordIssue },
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

        // A verified moderator has to approve the newcomer before they can use the panel
        await notify({
            recipientType: "moderator",
            recipientIds: await moderatorIds(),
            type: "moderator_pending",
            title: `${doc.name} wants to join the moderators`,
            body: `${doc.email} registered and needs verification.`,
            link: "/moderator/me/moderators",
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
