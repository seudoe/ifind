import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { empAuthCookie, signEmpToken } from "@/lib/employerAuth";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!email || !password) {
            return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
        }

        await connectDB();
        const employer = await Employer.findOne({ email }).select("+password");
        if (!employer) {
            return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
        }
        if (!employer.password && employer.linkedinId) {
            return NextResponse.json({ success: false, error: "This account was created using LinkedIn. Please sign in with LinkedIn." }, { status: 400 });
        }
        if (!employer.password || !(await bcrypt.compare(password, employer.password))) {
            return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
        }
        if (employer.isBanned) {
            return NextResponse.json({ success: false, error: "Your account has been suspended" }, { status: 403 });
        }
        if (employer.deleteDetails?.deleted) {
            return NextResponse.json({ success: false, error: "This account has been deleted" }, { status: 403 });
        }

        employer.lastLoginAt = new Date();
        await employer.save();

        const cookie = empAuthCookie(signEmpToken({ employerId: employer.id, email: employer.email, name: employer.name, role: "employer" }));
        const response = NextResponse.json({ success: true, data: { employerId: employer.id } });
        response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
    } catch (error) {
        console.error("[employer/auth/login]", error);
        return NextResponse.json({ success: false, error: "Unable to sign in" }, { status: 500 });
    }
}
