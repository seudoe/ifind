import { paidAiAllowed } from "@/lib/aiExtractionQuota";
import { isImageKitUrl } from "@/lib/uploads";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
    parseResumeWithHF,
    parseResumeWithBestAI,
} from "@/lib/resumeParser";
import { withBilling } from "@/lib/usage/withBilling";

export const runtime = "nodejs";
export const maxDuration = 120;

async function handlePost() {
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
        // Only ever fetch a file our own upload route produced, even if the stored value were tampered with.
        if (!isImageKitUrl(user.resume.driveViewLink)) {
            return NextResponse.json({ success: false, error: "Stored resume location is not valid" }, { status: 400 });
        }
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

        // Determine extractor based on LinkedIn verification (credits are charged by withBilling)
        const isLinkedInVerified =
            user.linkedinDetails?.email_verified === true;

        const canUseAI =
            isLinkedInVerified && (await paidAiAllowed());

        let parsedData;
        let extractorUsed: "ai" | "hf";

        if (canUseAI) {
            try {
                parsedData = await parseResumeWithBestAI(pdfBuffer);
            } catch (error) {
                throw error;
            }
            extractorUsed = "ai";
        } else {
            parsedData = await parseResumeWithHF(pdfBuffer);
            extractorUsed = "hf";
        }

        user.resume.parsedData = parsedData;
        await user.save();

        // Trigger vectorization & recommendation scoring in background
        if (parsedData) {
            const { scheduleVectorize } = await import("@/lib/vectorizer");
            await scheduleVectorize(session.userId, parsedData);
        }

        return NextResponse.json({
            success: true,
            message: "Resume re-extracted successfully",
            data: parsedData,
            extractorUsed,
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

export const POST = withBilling("resume-parse", handlePost);
