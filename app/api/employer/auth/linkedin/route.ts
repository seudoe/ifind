import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Employer entry point into the shared LinkedIn flow. */
export function GET(request: NextRequest) {
    return NextResponse.redirect(new URL("/api/auth/linkedin?as=employer", request.url));
}
