import { isObjectId } from "@/lib/validate";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
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
        const rejectionReason = typeof body?.rejectionReason === "string" && body.rejectionReason.trim()
            ? body.rejectionReason.trim()
            : "Rejected by moderator";

        await connectDB();
        const now = new Date();

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
                { success: false, error: "No matching internship IDs found to reject" },
                { status: 400 },
            );
        }

        if (source === "employer") {
            const rejectedIds: string[] = [];
            for (const id of validIds) {
                const doc = await PlatformInternship.findOne({ _id: id, status: { $ne: "draft" } });
                if (!doc) continue;
                doc.moderation.status = "manually_rejected";
                doc.moderation.reviewedBy = session.moderatorId;
                doc.moderation.reviewedAt = now;
                doc.moderation.rejectionReason = rejectionReason;
                await doc.save();
                rejectedIds.push(id);

                notifyCompany({
                    companyId: doc.companyId,
                    type: "internship_rejected",
                    title: `"${doc.name}" was rejected`,
                    body: `Reason: ${rejectionReason}`,
                    link: `/employer/company/${doc.companyId}/internships/${doc._id}/overview`,
                    actor: { kind: "moderator", id: null, name: "iFind moderation" },
                }).catch(() => {});
            }

            return NextResponse.json({
                success: true,
                processed: rejectedIds.length,
                total: validIds.length,
                message: isAllFiltered
                    ? `Successfully rejected all ${rejectedIds.length} filtered internships`
                    : `Successfully rejected ${rejectedIds.length} internships`,
            });
        }

        // Scraped internships in staging
        const res = await StagedInternship.updateMany(
            { _id: { $in: validIds } },
            {
                $set: {
                    "moderation.status": "manually_rejected",
                    "moderation.reviewedBy": session.moderatorId,
                    "moderation.reviewedAt": now,
                    "moderation.rejectionReason": rejectionReason,
                },
            },
        );

        return NextResponse.json({
            success: true,
            processed: res.modifiedCount,
            total: validIds.length,
            message: isAllFiltered
                ? `Successfully rejected all ${res.modifiedCount} filtered internships`
                : `Successfully rejected ${res.modifiedCount} internships`,
        });
    } catch (error) {
        console.error("[moderator/internships/batch-reject POST]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
