import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { requireSecret } from "@/lib/secrets";

const COOKIE_NAME = "ifind_token";

export interface AuthSession {
  userId: string;
  email: string;
  username: string;
  role: "student";
}

function getJwtSecret(): string {
  return requireSecret("JWT_SECRET");
}

export function signToken(session: AuthSession): string {
  return jwt.sign(session, getJwtSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthSession | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? verifyToken(token) : null;
  if (!session) return null;
  // A banned student keeps a valid 30-day token, so the ban is checked on every request (cached for a minute).
  const { isUserBanned } = await import("@/lib/banCheck");
  return (await isUserBanned(session.userId)) ? null : session;
}

export function authCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days (1 month)
      path: "/",
    },
  };
}

export { COOKIE_NAME };
