import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { revokeStudentSessions } from "@/lib/banCheck";
import { log } from "@/lib/logger";

export async function POST() {
  // Clearing the cookie only logs out this browser; bumping the session version also kills a copied or stolen token.
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const session = token ? verifyToken(token) : null;
    if (session) await revokeStudentSessions(session.userId);
  } catch (error) {
    console.error("[auth/logout] could not revoke sessions", error);
  }
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  log.info("auth/logout", "user signed out");
  return response;
}
