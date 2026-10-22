import { aiExtractionsUsed, paidAiAllowed, releaseAiExtraction, reserveAiExtraction } from "@/lib/aiExtractionQuota";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
    uploadResumeToImageKit,
    deleteResumeFromImageKit,
} from "@/lib/imagekit";
import {
    parseResumeWithHF,
    parseResumeWithBestAI,
    getCurrentMonthYear,
    AI_EXTRACTION_MONTHLY_LIMIT,
} from "@/lib/resumeParser";
import { withBilling } from "@/lib/usage/withBilling";
import { looksLikePdf } from "@/lib/uploads";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

async function handlePost(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Not authenticated" },
                { status: 401 },
            );
        }

        const rl = await hit("upload", session.userId, RULES.uploadUser);
        if (!rl.ok) return tooManyRequests(rl.retryAfter);

        const formData = await req.formData();
        const file = formData.get("resume") as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No resume file provided" },
                { status: 400 },
            );
        }
        if (file.type !== "application/pdf") {
            return NextResponse.json(
                { success: false, error: "Only PDF files are accepted" },
                { status: 400 },
            );
        }
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: "File must be under 5MB" },
                { status: 400 },
            );
        }

        await connectDB();
        const user = await User.findById(session.userId);
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Student user not found" },
                { status: 404 },
            );
        }

        // Clean up any existing pending upload from a previous uncommitted attempt
        const oldPendingFileId = user.resume?.pendingFileId;
        if (oldPendingFileId) {
            console.log(
                `[resume/upload-temp] Cleaning up previous pending ImageKit file: ${oldPendingFileId}`,
            );
            await deleteResumeFromImageKit(oldPendingFileId);
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (!looksLikePdf(buffer)) {
            return NextResponse.json(
                { success: false, error: "That file is not a valid PDF" },
                { status: 400 },
            );
        }
        const userIdStr = (user._id || user.id).toString();
        const fileName = `${userIdStr}_resume_${Date.now()}.pdf`;

        // 1. Upload to ImageKit as pending
        const { fileId, url } = await uploadResumeToImageKit(
            buffer,
            fileName,
            "/resumes",
        );

        // 2. Determine extractor based on LinkedIn verification + monthly quota
        const isLinkedInVerified =
            user.linkedinDetails?.email_verified === true;
        const currentMonth = getCurrentMonthYear();

        // The monthly allowance is taken atomically before the paid model is called (see lib/aiExtractionQuota.ts).
        const userId = (user._id || user.id).toString();
        const canUseAI =
            isLinkedInVerified &&
            (await paidAiAllowed()) &&
            (await reserveAiExtraction(userId, currentMonth, AI_EXTRACTION_MONTHLY_LIMIT));

        let pendingParsedData;
        let extractorUsed: "ai" | "hf";

        if (canUseAI) {
            try {
                pendingParsedData = await parseResumeWithBestAI(buffer);
            } catch (error) {
                await releaseAiExtraction(userId);
                throw error;
            }
            extractorUsed = "ai";
        } else {
            pendingParsedData = await parseResumeWithHF(buffer);
            extractorUsed = "hf";
        }

        // 3. Check if user already has existing resume data
        const existingParsedData = user.resume?.parsedData ?? null;
        const oldDriveFileId = user.resume?.driveFileId ?? null;
        const hasExistingResume = Boolean(oldDriveFileId || existingParsedData);

        if (!hasExistingResume) {
            // Auto-commit immediately: delete old active file if it existed
            if (oldDriveFileId && oldDriveFileId !== fileId) {
                await deleteResumeFromImageKit(oldDriveFileId);
            }

            user.resume = {
                driveFileId: fileId,
                driveViewLink: url,
                uploadedAt: new Date(),
                parsedData: pendingParsedData,
                pendingFileId: null,
                pendingViewLink: null,
                pendingParsedData: null,
            };
            user.profileCompletionScore = Math.min(
                100,
                (user.profileCompletionScore || 20) + 40,
            );
            if (pendingParsedData) {
                user.vectorizationStatus = "processing";
            }
            await user.save();

            // Trigger vectorization in background for auto-commit
            if (pendingParsedData) {
                const { vectorizeAndRecommendUser } = await import("@/lib/vectorizer");
                void vectorizeAndRecommendUser((user._id || user.id).toString(), pendingParsedData);
            }

            return NextResponse.json({
                success: true,
                data: {
                    pendingFileId: fileId,
                    pendingViewLink: url,
                    pendingParsedData,
                    existingParsedData: null,
                    autoCommitted: true,
                    extractorUsed,
                    aiUsedThisMonth: await aiExtractionsUsed(userId),
                    aiMonthlyLimit: AI_EXTRACTION_MONTHLY_LIMIT,
                },
            });
        }

        // Has existing data: store in pending fields for side-by-side comparison
        if (!user.resume) user.resume = {};
        user.resume.pendingFileId = fileId;
        user.resume.pendingViewLink = url;
        user.resume.pendingParsedData = pendingParsedData;
        await user.save();

        return NextResponse.json({
            success: true,
            data: {
                pendingFileId: fileId,
                pendingViewLink: url,
                pendingParsedData,
                existingParsedData,
                autoCommitted: false,
                extractorUsed,
                aiUsedThisMonth: await aiExtractionsUsed(userId),
                aiMonthlyLimit: AI_EXTRACTION_MONTHLY_LIMIT,
            },
        });
    } catch (err) {
        console.error("[resume/upload-temp POST]", err);
        return NextResponse.json(
            {
                success: false,
                error: err instanceof Error ? err.message : "Upload failed",
            },
            { status: 500 },
        );
    }
}

export const POST = withBilling("resume-parse", handlePost);
