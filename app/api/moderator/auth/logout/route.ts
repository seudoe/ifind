import { NextResponse } from "next/server";
import { MOD_COOKIE_NAME } from "@/lib/moderatorAuth";

export const runtime = "nodejs";

export async function POST() {
    const response = NextResponse.json({
        success: true,
        message: "Logged out",
    });
    response.cookies.set(MOD_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
}
