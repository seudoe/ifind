import { NextRequest, NextResponse } from "next/server";
import { verifyModToken } from "@/lib/moderatorAuth";

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── Moderator dynamic pages (/moderator/[username]/...) ──────────────────────
    if (
        pathname.startsWith("/moderator/") &&
        !pathname.startsWith("/moderator/login") &&
        !pathname.startsWith("/moderator/register") &&
        !pathname.startsWith("/moderator/pending")
    ) {
        const token = request.cookies.get("ifind_mod_token")?.value;
        if (!token) {
            return NextResponse.redirect(
                new URL("/moderator/login", request.url),
            );
        }
        const session = verifyModToken(token);
        if (!session || session.role !== "moderator") {
            return NextResponse.redirect(
                new URL("/moderator/login", request.url),
            );
        }
        if (!session.isVerified) {
            return NextResponse.redirect(
                new URL("/moderator/pending", request.url),
            );
        }

        // Optional: Ensure the URL username matches the logged in user's username
        // const usernameInUrl = pathname.split('/')[2];
        // if (usernameInUrl !== session.username) {
        //     return NextResponse.redirect(new URL(`/moderator/${session.username}/internships`, request.url));
        // }

        return NextResponse.next();
    }

    // ── Moderator API mutation routes (excluding /api/moderator/auth/...) ──
    if (
        pathname.startsWith("/api/moderator/") &&
        !pathname.startsWith("/api/moderator/auth/")
    ) {
        const token = request.cookies.get("ifind_mod_token")?.value;
        if (!token) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }
        const session = verifyModToken(token);
        if (!session || session.role !== "moderator") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }
        if (!session.isVerified) {
            return NextResponse.json(
                {
                    error: "Only verified moderators can perform this action",
                },
                { status: 403 },
            );
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/moderator/:path*", "/api/moderator/((?!auth/).*)"],
};
