import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "ifind_token";
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthSession {
  userId: string;
  email: string;
  username: string;
  role: "student";
}

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured. Add it to .env.local.");
  }
  return JWT_SECRET;
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
  return token ? verifyToken(token) : null;
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
