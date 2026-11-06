import { isObjectId } from "@/lib/validate";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { batchPublishApprovedInternships, vectorizePlatformInternships } from "@/lib/internship-vectorizer";
import { notifyCompany } from "@/lib/employer/notify";
import PlatformInternship from "@/models/PlatformInternship";
import { StagedInternship } from "@/models/Internship";
import { buildModerationFilterQuery, ModerationFilters } from "@/lib/moderatorQuery";

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
        const source = body?.source === "employer" ? "employer" : "scraped";
        const isAllFiltered = Boolean(body?.allFiltered);
        const filters = body?.filters as ModerationFilters | undefined;

        await connectDB();

        let validIds: string[] = [];
        if (isAllFiltered && filters) {
            const query = buildModerationFilterQuery({ ...filters, source });
            const matchingDocs = source === "employer"
                ? await PlatformInternship.find(query).select("_id").lean()
                : await StagedInternship.find(query).select("_id").lean();
            validIds = matchingDocs.map((d: any) => String(d._id));
        } else {
            const ids: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
            validIds = ids.filter((id: unknown): id is string => typeof id === "string" && isObjectId(id));
        }

        if (validIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "No matching internship IDs found to approve" },
                { status: 400 },
            );
        }

        if (source === "employer") {
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
                // Vectorize employer listings in chunks if necessary
                await vectorizePlatformInternships(approvedIds.slice(0, 50), true);
            }
            return NextResponse.json({
                success: true,
                processed: approvedIds.length,
                indexedIds: approvedIds,
                total: validIds.length,
                message: isAllFiltered
                    ? `Successfully approved all ${approvedIds.length} filtered employer internships`
                    : "the batch has been approved and saved to collection(database)",
            });
        }

        // Scraped internships:
        // When approving all filtered or large batches (> 25 items), we run vectorisation in background
        // to prevent HTTP timeout, and return immediate confirmation to moderator.
        const useBackground = validIds.length > 25 || isAllFiltered;
        const res = await batchPublishApprovedInternships(validIds, true, session.moderatorId, useBackground);

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

        const message = useBackground
            ? `Approved ${validIds.length} internships — vectorisation is running in the background`
            : res.processed === validIds.length
                ? "the batch has been approved and saved to collection(database)"
                : `${res.processed} of ${validIds.length} internships approved and indexed (${validIds.length - res.processed} failed)`;

        return NextResponse.json({
            success: true,
            processed: res.processed,
            indexedIds: res.indexedIds,
            total: validIds.length,
            message,
        });
    } catch (error) {
        console.error("[moderator/internships/batch-approve POST]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
