import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { log } from "@/lib/logger";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  log.info("auth/logout", "user signed out");
  return response;
}
