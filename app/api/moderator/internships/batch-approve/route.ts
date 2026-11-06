import { isObjectId } from "@/lib/validate";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { batchPublishApprovedInternships, vectorizePlatformInternships } from "@/lib/internship-vectorizer";
import { notifyCompany } from "@/lib/employer/notify";
import PlatformInternship from "@/models/PlatformInternship";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            );
        }

        const body = await request.json().catch(() => ({}));
        const ids: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
        const source = body?.source === "employer" ? "employer" : "scraped";

        const validIds = ids.filter((id: unknown): id is string => typeof id === "string" && isObjectId(id));
        if (validIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "No valid internship IDs provided" },
                { status: 400 },
            );
        }

        if (source === "employer") {
            await connectDB();
            const approvedIds: string[] = [];
            for (const id of validIds) {
                const doc = await PlatformInternship.findOne({ _id: id, status: { $ne: "draft" } });
                if (!doc) continue;
                doc.moderation.status = "manually_approved";
                doc.moderation.reviewedBy = session.moderatorId;
                doc.moderation.reviewedAt = new Date();
                doc.moderation.rejectionReason = null;
                await doc.save();
                approvedIds.push(id);
                notifyCompany({
                    companyId: doc.companyId,
                    type: "internship_approved",
                    title: `"${doc.name}" was approved`,
                    body: "A moderator approved your listing. It is now visible to students.",
                    link: `/employer/company/${doc.companyId}/internships/${doc._id}/overview`,
                    actor: { kind: "moderator", id: null, name: "iFind moderation" },
                }).catch(() => {});
            }
            if (approvedIds.length > 0) {
                await vectorizePlatformInternships(approvedIds, true);
            }
            return NextResponse.json({
                success: true,
                processed: approvedIds.length,
                indexedIds: approvedIds,
                total: validIds.length,
                message: "the batch has been approved and saved to collection(database)",
            });
        }

        // Scraped internships:
        // Sent to vectoriser which processes them one at a time:
        // vectorises, moves from staging to live collection, updates graph, then triggers recommendation pipeline.
        // Staged internships that are not yet processed remain in staging untouched with pending_review.
        const res = await batchPublishApprovedInternships(validIds, true, session.moderatorId);

        if (!res.success && res.processed === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Vectoriser service unreachable or failed to process batch. Check VECTORISER_URL.",
                    processed: 0,
                    total: validIds.length,
                },
                { status: 502 },
            );
        }

        return NextResponse.json({
            success: true,
            processed: res.processed,
            indexedIds: res.indexedIds,
            total: validIds.length,
            message: res.processed === validIds.length
                ? "the batch has been approved and saved to collection(database)"
                : `${res.processed} of ${validIds.length} internships approved and indexed (${validIds.length - res.processed} failed)`,
        });
    } catch (error) {
        console.error("[moderator/internships/batch-approve POST]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
