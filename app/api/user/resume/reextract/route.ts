import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
    parseResumeWithHF,
    parseResumeWithBestAI,
    getCurrentMonthYear,
    AI_EXTRACTION_MONTHLY_LIMIT,
} from "@/lib/resumeParser";

export const runtime = "nodejs";

export async function POST() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Not authenticated" },
                { status: 401 },
            );
        }

        await connectDB();
        const user = await User.findById(session.userId);
        if (!user || !user.resume?.driveViewLink) {
            return NextResponse.json(
                { success: false, error: "No active resume to re-extract" },
                { status: 400 },
            );
        }

        // Fetch PDF from ImageKit URL
        const pdfResponse = await fetch(user.resume.driveViewLink);
        if (!pdfResponse.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unable to download current resume from ImageKit",
                },
                { status: 500 },
            );
        }

        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        // Determine extractor based on LinkedIn verification + monthly quota
        const isLinkedInVerified =
            user.linkedinDetails?.email_verified === true;
        const currentMonth = getCurrentMonthYear();

        if (user.aiExtractionMonthYear !== currentMonth) {
            user.aiExtractionUsedThisMonth = 0;
            user.aiExtractionMonthYear = currentMonth;
        }

        const aiUsed = user.aiExtractionUsedThisMonth ?? 0;
        const canUseAI =
            isLinkedInVerified && aiUsed < AI_EXTRACTION_MONTHLY_LIMIT;

        let parsedData;
        let extractorUsed: "ai" | "hf";

        if (canUseAI) {
            parsedData = await parseResumeWithBestAI(pdfBuffer);
            user.aiExtractionUsedThisMonth = aiUsed + 1;
            user.aiExtractionMonthYear = currentMonth;
            extractorUsed = "ai";
        } else {
            parsedData = await parseResumeWithHF(pdfBuffer);
            extractorUsed = "hf";
        }

        user.resume.parsedData = parsedData;
        await user.save();

        // Trigger vectorization & recommendation scoring in background
        if (parsedData) {
            const { vectorizeAndRecommendUser } =
                await import("@/lib/vectorizer");
            void vectorizeAndRecommendUser(session.userId, parsedData);
        }

        return NextResponse.json({
            success: true,
            message: "Resume re-extracted successfully",
            data: parsedData,
            extractorUsed,
            aiUsedThisMonth: user.aiExtractionUsedThisMonth,
            aiMonthlyLimit: AI_EXTRACTION_MONTHLY_LIMIT,
        });
    } catch (err) {
        console.error("[resume/reextract POST]", err);
        return NextResponse.json(
            {
                success: false,
                error:
                    err instanceof Error ? err.message : "Re-extraction failed",
            },
            { status: 500 },
        );
    }
}
