import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { changeStatus } from "@/lib/employer/applications";
import { bulkStatusSchema, zodMessage } from "@/lib/employer/validation";
import Application from "@/models/Application";

export const runtime = "nodejs";

/** Body: { ids, status }. Each item is validated on its own; one illegal move doesn't block the rest. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
    try {
        const access = await requireCompanyRole((await params).companyId, "recruiter");
        if (isResponse(access)) return access;

        const parsed = bulkStatusSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const { ids, status } = parsed.data;

        const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
        // Scoped to the company: foreign ids simply don't come back and are reported as not found
        const apps = await Application.find({ _id: { $in: valid }, companyId: access.company._id }).select("status");
        const byId = new Map(apps.map((a) => [String(a._id), a]));

        const updated: string[] = [];
        const failed: { id: string; error: string }[] = [];
        for (const id of ids) {
            const app = byId.get(id);
            if (!app) { failed.push({ id, error: "Application not found" }); continue; }
            const r = await changeStatus(app, access.company._id, status, access.employer._id);
            if (r.ok) updated.push(id); else failed.push({ id, error: r.error });
        }
        return NextResponse.json({ success: true, data: { updated, failed } });
    } catch (error) {
        console.error("[employer/applications bulk-status]", error);
        return NextResponse.json({ success: false, error: "Bulk update failed" }, { status: 500 });
    }
}
