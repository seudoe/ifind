import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { requireSecret } from "@/lib/secrets";

const COOKIE_NAME = "ifind_token";

export interface AuthSession {
  userId: string;
  email: string;
  username: string;
  role: "student";
  /** Session version the token was issued at; must equal User.tokenVersion. */
  tv?: number;
}

function getJwtSecret(): string {
  return requireSecret("JWT_SECRET");
}

export function signToken(session: AuthSession, tokenVersion = 0): string {
  return jwt.sign({ ...session, tv: tokenVersion }, getJwtSecret(), { expiresIn: "30d" });
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
  // A token stays cryptographically valid for 30 days, so ban and revocation are checked against the database
  // on every request (cached for seconds). A missing account, a ban, or an outdated session version ends the session.
  const { getAccountState } = await import("@/lib/banCheck");
  const state = await getAccountState(session.userId);
  if (!state) return session; // lookup failed; routes that need the database will fail on their own
  if (!state.exists || state.banned || (session.tv ?? 0) !== state.tokenVersion) return null;
  return session;
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
