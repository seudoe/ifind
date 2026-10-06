import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

/** Change password, or set one for a LinkedIn-only account (no currentPassword needed then). */
export async function POST(request: NextRequest) {
    try {
        const auth = await requireEmployer();
        if (isResponse(auth)) return auth;

        const body = await request.json();
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
        if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return NextResponse.json({ success: false, error: "Password must be at least 8 characters and include an uppercase letter and number" }, { status: 400 });
        }

        await connectDB();
        const employer = await Employer.findById(auth._id).select("+password");
        if (!employer) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        if (employer.password && !(await bcrypt.compare(currentPassword, employer.password))) {
            return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
        }
        employer.password = await bcrypt.hash(newPassword, 12);
        await employer.save();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/account/password]", error);
        return NextResponse.json({ success: false, error: "Unable to update password" }, { status: 500 });
    }
}
