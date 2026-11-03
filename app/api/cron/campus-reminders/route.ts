import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendReminders } from "@/lib/campus/announce";
import { connectDB } from "@/lib/db";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorised(request: NextRequest, secret: string): boolean {
    // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; other schedulers can send "x-cron-secret"
    const given = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sends the 24-hour reminders (events, internship deadlines). Idempotent: run it as often as you like.
 * Disabled (503) until CRON_SECRET is set; 401 without the right secret.
 */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ success: false, error: "CRON_SECRET is not configured" }, { status: 503 });
    if (!authorised(request, secret)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    try {
        await connectDB();
        const counts = await sendReminders();
        log.info("campus/reminders", "run complete", { ...counts });
        return NextResponse.json({ success: true, data: counts });
    } catch (error) {
        console.error("[cron/campus-reminders]", error);
        return NextResponse.json({ success: false, error: "Run failed" }, { status: 500 });
    }
}
