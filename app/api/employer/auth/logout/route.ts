import { NextResponse } from "next/server";
import { EMP_COOKIE_NAME } from "@/lib/employerAuth";

export const runtime = "nodejs";

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(EMP_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
}
