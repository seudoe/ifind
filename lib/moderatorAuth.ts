import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const MOD_COOKIE_NAME = "ifind_mod_token";

export interface ModeratorSession {
    moderatorId: string;
    email: string;
    name: string;
    role: "moderator";
    isVerified: boolean;
}

function getModJwtSecret(): string {
    const secret = process.env.MOD_JWT_SECRET;
    if (!secret) {
        throw new Error(
            "MOD_JWT_SECRET is not configured. Add it to .env.local.",
        );
    }
    return secret;
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

export { getModJwtSecret };
