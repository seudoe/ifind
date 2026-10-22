import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { EMP_COOKIE_NAME, verifyEmpToken } from "@/lib/employerAuth";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

export async function POST() {
    // Clearing the cookie only logs out this browser; bumping the session version also kills a copied or stolen token.
    try {
        const token = (await cookies()).get(EMP_COOKIE_NAME)?.value;
        const session = token ? verifyEmpToken(token) : null;
        if (session) {
            await connectDB();
            await Employer.updateOne({ _id: session.employerId }, { $inc: { tokenVersion: 1 } });
        }
    } catch (error) {
        console.error("[employer/auth/logout] could not revoke sessions", error);
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(EMP_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
}
