import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { isAnalyzeKind, modelFor, NO_VECTORS } from "@/lib/moderator/analyze";
import { isObjectId } from "@/lib/validate";
import Company from "@/models/Company";
import Application from "@/models/Application";
import { internscraperUrl } from "@/lib/services";

export const runtime = "nodejs";

/** Analyze tab detail: the full stored document (no vectors) plus what is known around it. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
    try {
        const session = await getModSession();
        if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

        const { kind, id } = await params;
        if (!isAnalyzeKind(kind) || !isObjectId(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        await connectDB();
        const Model = modelFor(kind);
        const doc = await Model.findById(id).select(NO_VECTORS).lean();
        if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        const _id = new mongoose.Types.ObjectId(id);
        const [hasVectors, company, applications] = await Promise.all([
            Model.exists({ _id, bert_vector: { $ne: null } }).then(Boolean),
            kind === "employer"
                ? Company.findById((doc as { companyId?: unknown }).companyId).select("name logo verification.status isActive").lean()
                : null,
            kind === "employer" ? Application.countDocuments({ internshipId: _id }) : null,
        ]);

        return NextResponse.json({
            success: true,
            // `company` on the document is the company NAME; the Company record goes under its own key
            data: { ...doc, kind, hasVectors, companyRecord: company, applicationCount: applications },
            pipelineConfigured: Boolean(internscraperUrl()),
        });
    } catch (error) {
        console.error("[moderator/analyze/detail GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
