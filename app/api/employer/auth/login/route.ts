import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { checkPassword } from "@/lib/passwords";
import { limitAuth, RULES } from "@/lib/rateLimit";
import { empAuthCookie, signEmpToken } from "@/lib/employerAuth";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!email || !password || password.length > 128 || email.length > 254) {
            return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
        }

        const limited = await limitAuth(request, "emp-login", RULES.loginIp, { id: email, rule: RULES.loginAccount });
        if (limited) return limited;

        await connectDB();
        const employer = await Employer.findOne({ email }).select("+password");
        // One response (and one amount of work) for unknown account, LinkedIn-only account and wrong password.
        if (!(await checkPassword(password, employer?.password)) || !employer) {
            return NextResponse.json({ success: false, error: "Invalid credentials. If you signed up with LinkedIn, use Continue with LinkedIn." }, { status: 401 });
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
