import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSecret } from "@/lib/secrets";
import Moderator from "@/models/Moderator";

export const MOD_COOKIE_NAME = "ifind_mod_token";

export interface ModeratorSession {
    moderatorId: string;
    email: string;
    name: string;
    role: "moderator";
    isVerified: boolean;
    /** Session version the token was issued at; must equal Moderator.tokenVersion. */
    tv?: number;
}

function getModJwtSecret(): string {
    return requireSecret("MOD_JWT_SECRET");
}

export function signModToken(session: ModeratorSession, tokenVersion = 0): string {
    return jwt.sign({ ...session, tv: tokenVersion }, getModJwtSecret(), { expiresIn: "24h" });
}

export function verifyModToken(token: string): ModeratorSession | null {
    try {
        return jwt.verify(token, getModJwtSecret()) as ModeratorSession;
    } catch {
        return null;
    }
}

/**
 * The signed-in moderator, checked against the database on every call: the token's own isVerified flag is only
 * a hint, so a ban, an un-verify or a logout takes effect at once instead of when the 24-hour token expires.
 * Returns null unless the account exists, is not banned, is verified, and the session version is current.
 */
export async function getModSession(): Promise<ModeratorSession | null> {
    const session = await getModSessionAny();
    return session?.isVerified ? session : null;
}

/** Same checks, but also returns a not-yet-verified moderator (only the "pending approval" screen needs that). */
export async function getModSessionAny(): Promise<ModeratorSession | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(MOD_COOKIE_NAME)?.value;
    const session = token ? verifyModToken(token) : null;
    if (!session || session.role !== "moderator") return null;
    await connectDB();
    const mod = await Moderator.findById(session.moderatorId).select("isBanned isVerified tokenVersion").lean();
    if (!mod || mod.isBanned || (session.tv ?? 0) !== (mod.tokenVersion ?? 0)) return null;
    return { ...session, isVerified: mod.isVerified === true };
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
    const session = await getModSessionAny();
    if (!session) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!session.isVerified) {
        return NextResponse.json({ success: false, error: "Only verified moderators can perform this action" }, { status: 403 });
    }
    return session;
}

export { getModJwtSecret };
