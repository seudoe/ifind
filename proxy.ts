import { NextRequest, NextResponse } from "next/server";
import { verifyModToken } from "@/lib/moderatorAuth";
import { verifyEmpToken } from "@/lib/employerAuth";
import { log } from "@/lib/logger";

/** Logs an access denial; returns nothing so callers keep their original response. */
const denied = (area: string, request: NextRequest, reason: string) =>
    log.warn(`proxy/${area}`, "access denied", { method: request.method, path: request.nextUrl.pathname, reason });

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth on top of SameSite=Lax cookies: a state-changing /api request from a browser must come
 * from this site. Browsers always send Origin (or Sec-Fetch-Site) on cross-site writes; server-to-server callers
 * send neither and are unaffected.
 */
function isCrossSiteWrite(request: NextRequest): boolean {
    if (SAFE_METHODS.has(request.method) || !request.nextUrl.pathname.startsWith("/api/")) return false;
    if (request.headers.get("sec-fetch-site") === "cross-site") return true;
    const origin = request.headers.get("origin");
    if (!origin) return false;
    try {
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
        return new URL(origin).host !== host;
    } catch {
        return true; // "null" or malformed origin
    }
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isCrossSiteWrite(request)) {
        denied("csrf", request, `cross-site write from ${request.headers.get("origin") ?? "unknown origin"}`);
        return NextResponse.json({ success: false, error: "Cross-site request blocked" }, { status: 403 });
    }

    // ── Moderator dynamic pages (/moderator/[username]/...) ──────────────────────
    if (
        pathname.startsWith("/moderator/") &&
        !pathname.startsWith("/moderator/login") &&
        !pathname.startsWith("/moderator/register") &&
        !pathname.startsWith("/moderator/pending")
    ) {
        const token = request.cookies.get("ifind_mod_token")?.value;
        if (!token) {
            denied("moderator", request, "no token");
            return NextResponse.redirect(
                new URL("/moderator/login", request.url),
            );
        }
        const session = verifyModToken(token);
        if (!session || session.role !== "moderator") {
            denied("moderator", request, "invalid token");
            return NextResponse.redirect(
                new URL("/moderator/login", request.url),
            );
        }
        if (!session.isVerified) {
            denied("moderator", request, "not verified");
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
            denied("moderator-api", request, "no token");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }
        const session = verifyModToken(token);
        if (!session || session.role !== "moderator") {
            denied("moderator-api", request, "invalid token");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }
        if (!session.isVerified) {
            denied("moderator-api", request, "not verified");
            return NextResponse.json(
                {
                    error: "Only verified moderators can perform this action",
                },
                { status: 403 },
            );
        }
        return NextResponse.next();
    }

    // ── Employer pages (public: login, register; landing is /employer exactly) ──
    if (pathname.startsWith("/employer/")) {
        const isPublic = pathname === "/employer/login" || pathname === "/employer/register";
        if (!isPublic) {
            const token = request.cookies.get("ifind_emp_token")?.value;
            if (!token || !verifyEmpToken(token)) {
                denied("employer", request, token ? "invalid token" : "no token");
                return NextResponse.redirect(new URL("/employer/login", request.url));
            }
        }
        return NextResponse.next();
    }

    // ── Employer API (auth routes are public) ──
    if (pathname.startsWith("/api/employer/") && !pathname.startsWith("/api/employer/auth/")) {
        const size = Number(request.headers.get("content-length") ?? 0);
        if (pathname !== "/api/employer/uploads" && size > 256 * 1024) {
            denied("employer-api", request, `request too large (${size} bytes)`);
            return NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
        }
        const token = request.cookies.get("ifind_emp_token")?.value;
        if (!token || !verifyEmpToken(token)) {
            denied("employer-api", request, token ? "invalid token" : "no token");
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/api/:path*",
        "/moderator/:path*",
        "/api/moderator/((?!auth/).*)",
        "/employer/:path*",
        "/api/employer/((?!auth/).*)",
    ],
};
