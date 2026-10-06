import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { empAuthCookie, signEmpToken } from "@/lib/employerAuth";
import { plainText } from "@/lib/employer/sanitize";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const name = typeof body.name === "string" ? plainText(body.name) : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const designation = typeof body.designation === "string" && plainText(body.designation) ? plainText(body.designation).slice(0, 80) : null;

        if (!name || !email || !password) {
            return NextResponse.json({ success: false, error: "Name, email, and password are required" }, { status: 400 });
        }
        if (name.length > 100) {
            return NextResponse.json({ success: false, error: "Name is too long" }, { status: 400 });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 });
        }
        if (password.length > 128 || email.length > 254) {
            return NextResponse.json({ success: false, error: "Email or password is too long" }, { status: 400 });
        }
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            return NextResponse.json({ success: false, error: "Password must be at least 8 characters and include an uppercase letter and number" }, { status: 400 });
        }

        await connectDB();
        const existing = await Employer.findOne({ email }).lean();
        if (existing) {
            const error = existing.linkedinId
                ? "This email is already registered using LinkedIn. Please sign in with LinkedIn."
                : "This email is already registered";
            return NextResponse.json({ success: false, error }, { status: 409 });
        }

        const employer = await Employer.create({ name, email, designation, password: await bcrypt.hash(password, 12) });
        const cookie = empAuthCookie(signEmpToken({ employerId: employer.id, email: employer.email, name: employer.name, role: "employer" }));
        const response = NextResponse.json({ success: true, data: { employerId: employer.id } }, { status: 201 });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
    } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === 11000) {
            return NextResponse.json({ success: false, error: "This email is already registered" }, { status: 409 });
        }
        console.error("[employer/auth/register]", error);
        return NextResponse.json({ success: false, error: "Unable to create account" }, { status: 500 });
    }
}
