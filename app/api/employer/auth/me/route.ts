import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getEmpSession } from "@/lib/employerAuth";
import Employer from "@/models/Employer";
import type { Employer as EmployerDTO } from "@/types/employer";

export const runtime = "nodejs";

export async function GET() {
    try {
        const session = await getEmpSession();
        if (!session) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

        await connectDB();
        const e = await Employer.findById(session.employerId).select("+password").lean();
        if (!e || e.isBanned || e.deleteDetails?.deleted) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
        }
        const data: EmployerDTO = {
            _id: String(e._id),
            name: e.name,
            email: e.email,
            isEmailVerified: e.isEmailVerified,
            hasPassword: !!e.password,
            linkedinLinked: !!e.linkedinId,
            profilePicture: e.profilePicture,
            phone: e.phone,
            designation: e.designation,
            role: "employer",
            isBanned: e.isBanned,
            lastLoginAt: e.lastLoginAt?.toISOString() ?? null,
            createdAt: e.createdAt.toISOString(),
        };
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("[employer/auth/me]", error);
        return NextResponse.json({ success: false, error: "Unable to load employer" }, { status: 500 });
    }
}
