import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { requireSecret } from "@/lib/secrets";
import type { EmployerSession } from "@/types/employer";

export const EMP_COOKIE_NAME = "ifind_emp_token";

function getEmpJwtSecret(): string {
    return requireSecret("EMP_JWT_SECRET");
}

export function signEmpToken(session: EmployerSession, tokenVersion = 0): string {
    return jwt.sign({ ...session, tv: tokenVersion }, getEmpJwtSecret(), { expiresIn: "7d" });
}

export function verifyEmpToken(token: string): EmployerSession | null {
    try {
        const s = jwt.verify(token, getEmpJwtSecret()) as EmployerSession;
        return s.role === "employer" ? s : null;
    } catch {
        return null;
    }
}

export async function getEmpSession(req?: Request): Promise<EmployerSession | null> {
    let token: string | undefined;

    // 1. Try reading Authorization header (Mobile APK Bearer token)
    if (req) {
        const auth = req.headers.get("authorization") || req.headers.get("x-auth-token");
        if (auth) {
            token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
        }
    }

    if (!token) {
        try {
            const h = await headers();
            const auth = h.get("authorization") || h.get("x-auth-token");
            if (auth) {
                token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
            }
        } catch {
            // outside request context
        }
    }

    // 2. Fall back to Cookie (Standard Web Browsers)
    if (!token) {
        try {
            const cookieStore = await cookies();
            token = cookieStore.get(EMP_COOKIE_NAME)?.value;
        } catch {
            // outside request context
        }
    }

    return token ? verifyEmpToken(token) : null;
}

export function empAuthCookie(token: string) {
    return {
        name: EMP_COOKIE_NAME,
        value: token,
        options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        },
    };
}
