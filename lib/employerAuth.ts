import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { EmployerSession } from "@/types/employer";

export const EMP_COOKIE_NAME = "ifind_emp_token";

function getEmpJwtSecret(): string {
    const secret = process.env.EMP_JWT_SECRET;
    if (!secret) throw new Error("EMP_JWT_SECRET is not configured. Add it to .env.local.");
    return secret;
}

export function signEmpToken(session: EmployerSession): string {
    return jwt.sign(session, getEmpJwtSecret(), { expiresIn: "7d" });
}

export function verifyEmpToken(token: string): EmployerSession | null {
    try {
        const s = jwt.verify(token, getEmpJwtSecret()) as EmployerSession;
        return s.role === "employer" ? s : null;
    } catch {
        return null;
    }
}

export async function getEmpSession(): Promise<EmployerSession | null> {
    const token = (await cookies()).get(EMP_COOKIE_NAME)?.value;
    return token ? verifyEmpToken(token) : null;
}

export function empAuthCookie(token: string) {
    return {
        name: EMP_COOKIE_NAME,
        value: token,
        options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
        },
    };
}
