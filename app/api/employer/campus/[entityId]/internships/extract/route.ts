import { NextRequest, NextResponse } from "next/server";
import { campusPostingBlocked, requireCampusRole } from "@/lib/campus/access";
import { checkSource, ExtractionUnavailable, extractInternship } from "@/lib/campus/extract";
import { getValidEmployer, isResponse } from "@/lib/employer/access";
import { log } from "@/lib/logger";
import { generateContent, isGeminiAvailable } from "@/lib/resume/geminiService";
import type { AuthSession } from "@/lib/auth";
import { withBilling } from "@/lib/usage/withBilling";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string }> };

const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status });

/** Lets the shared billing wrapper (rate limits, daily credits, usage log, refunds) serve employers: their id is the subject. */
async function employerAsSession(): Promise<AuthSession | null> {
    const e = await getValidEmployer();
    return e ? { userId: String(e._id), email: e.email, username: "", role: "student" } : null;
}

/**
 * POST { text }: reads a pasted notification and returns suggested fields for the internship form.
 * Coordinator and up. Nothing is saved or published here; the staff member reviews the suggestions in the form.
 * Costs the "campus-extract" credits; when AI is unavailable or the quota is used up the form still works by hand.
 */
async function handlePost(request: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "coordinator");
    if (isResponse(access)) return access;
    const blocked = campusPostingBlocked(access.entity);
    if (blocked) return blocked;

    let body: { text?: unknown };
    try {
        body = await request.json();
    } catch {
        return fail("Send the pasted text as JSON", 400);
    }
    const source = checkSource(body.text);
    if (!source.ok) return fail(source.error, 400);
    if (!isGeminiAvailable()) return fail("Automatic reading is not available right now. Fill the form by hand.", 503, { code: "AI_UNAVAILABLE" });

    try {
        const result = await extractInternship(source.text, generateContent);
        if (result.empty) return fail("Couldn't find internship details in that text. Check it is the company's notification, or fill the form by hand.", 422, { code: "NOTHING_FOUND" });
        return NextResponse.json({ success: true, data: { ...result, sourceText: source.text } });
    } catch (err) {
        if (err instanceof ExtractionUnavailable) {
            log.warn("campus/extract", "model failed", { error: err.message });
            return fail("Automatic reading failed. Try again in a moment or fill the form by hand.", 503, { code: "AI_FAILED" });
        }
        throw err;
    }
}

export const POST = withBilling<Ctx>("campus-extract", handlePost, { getSession: employerAsSession });
