import { isObjectId } from "@/lib/validate";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { notifyCompany } from "@/lib/employer/notify";
import PlatformInternship from "@/models/PlatformInternship";
import { StagedInternship } from "@/models/Internship";

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
        const rejectionReason = typeof body?.rejectionReason === "string" && body.rejectionReason.trim()
            ? body.rejectionReason.trim()
            : "Rejected by moderator";

        const validIds = ids.filter((id: unknown): id is string => typeof id === "string" && isObjectId(id));
        if (validIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "No valid internship IDs provided" },
                { status: 400 },
            );
        }

        await connectDB();
        const now = new Date();

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
                message: `Successfully rejected ${rejectedIds.length} internships`,
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
            message: `Successfully rejected ${res.modifiedCount} internships`,
        });
    } catch (error) {
        console.error("[moderator/internships/batch-reject POST]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
