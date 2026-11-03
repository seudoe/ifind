import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import mongoose from "mongoose";
import type { Outcome } from "./student";

export interface StudentCtx {
    userId: string;
    username: string;
}

/** Student session for /api/user/campus/** (banned or revoked sessions already come back as null from getSession). */
export async function requireStudent(): Promise<StudentCtx | NextResponse> {
    const session = await getSession();
    if (!session || !mongoose.isValidObjectId(session.userId)) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    await connectDB();
    return { userId: session.userId, username: session.username };
}

/** 429 when the student's campus write budget is spent, otherwise null. */
export async function limitStudentWrite(userId: string): Promise<NextResponse | null> {
    const r = await hit("campus:student-write", userId, RULES.campusStudentWrite);
    return r.ok ? null : tooManyRequests(r.retryAfter);
}

/** Maps a failed Outcome to the JSON error response: { success:false, error, code?, ...extra }. */
export function failure(o: Extract<Outcome, { ok: false }>): NextResponse {
    return NextResponse.json({ success: false, error: o.error, code: o.code, ...(o.extra ?? {}) }, { status: o.status });
}
