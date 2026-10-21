import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/secrets";

export const MOD_COOKIE_NAME = "ifind_mod_token";

export interface ModeratorSession {
    moderatorId: string;
    email: string;
    name: string;
    role: "moderator";
    isVerified: boolean;
}

function getModJwtSecret(): string {
    return requireSecret("MOD_JWT_SECRET");
}

export function signModToken(session: ModeratorSession): string {
    return jwt.sign(session, getModJwtSecret(), { expiresIn: "24h" });
}

export function verifyModToken(token: string): ModeratorSession | null {
    try {
        return jwt.verify(token, getModJwtSecret()) as ModeratorSession;
    } catch {
        return null;
    }
}

export async function getModSession(): Promise<ModeratorSession | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(MOD_COOKIE_NAME)?.value;
    return token ? verifyModToken(token) : null;
}

export function modAuthCookie(token: string) {
    return {
        name: MOD_COOKIE_NAME,
        value: token,
        options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            maxAge: 60 * 60 * 24, // 24 hours
            path: "/",
        },
    };
}

/**
 * For routes outside /api/moderator (which proxy.ts already guards): a verified moderator session, or the
 * 401/403 response to return. Never trust a client-supplied role.
 */
export async function requireVerifiedModerator(): Promise<ModeratorSession | NextResponse> {
    const session = await getModSession();
    if (!session || session.role !== "moderator") {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.isVerified) {
        return NextResponse.json({ success: false, error: "Only verified moderators can perform this action" }, { status: 403 });
    }
    return session;
}

export { getModJwtSecret };
