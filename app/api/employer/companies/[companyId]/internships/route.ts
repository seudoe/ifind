import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { applyInput, syncAutoClose, toInternshipDTO } from "@/lib/employer/internships";
import { internshipDraftSchema, zodMessage } from "@/lib/employer/validation";
import Application from "@/models/Application";
import PlatformInternship from "@/models/PlatformInternship";
import { INTERNSHIP_STATUSES } from "@/types/employer";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ companyId: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "recruiter");
        if (isResponse(access)) return access;
        const { company } = access;

        await syncAutoClose(company);

        const status = request.nextUrl.searchParams.get("status");
        const filter: Record<string, unknown> = { companyId: company._id };
        if (status && (INTERNSHIP_STATUSES as readonly string[]).includes(status)) filter.status = status;

        const [docs, statusCounts] = await Promise.all([
            PlatformInternship.find(filter).sort({ createdAt: -1 }).limit(200),
            PlatformInternship.aggregate<{ _id: string; n: number }>([
                { $match: { companyId: company._id } },
                { $group: { _id: "$status", n: { $sum: 1 } } },
            ]),
        ]);
        // One aggregate for all applicant counts (no N+1)
        const apps = await Application.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
            { $match: { internshipId: { $in: docs.map((d) => d._id) } } },
            { $group: { _id: "$internshipId", n: { $sum: 1 } } },
        ]);
        const items = docs.map((d) => toInternshipDTO(d, apps.find((a) => String(a._id) === String(d._id))?.n ?? 0));
        return NextResponse.json({
            success: true,
            data: { items, counts: Object.fromEntries(statusCounts.map((c) => [c._id, c.n])) },
        });
    } catch (error) {
        console.error("[employer/internships GET]", error);
        return NextResponse.json({ success: false, error: "Unable to load internships" }, { status: 500 });
    }
}

/** Create a draft. Only the title is required. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "recruiter");
        if (isResponse(access)) return access;

        const parsed = internshipDraftSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });

        const doc = new PlatformInternship({
            companyId: access.company._id,
            postedBy: access.employer._id,
            company: access.company.name,
            name: parsed.data.name,
            status: "draft",
        });
        applyInput(doc, parsed.data, access.company);
        await doc.save();
        return NextResponse.json({ success: true, data: toInternshipDTO(doc, 0) }, { status: 201 });
    } catch (error) {
        console.error("[employer/internships POST]", error);
        return NextResponse.json({ success: false, error: "Unable to create internship" }, { status: 500 });
    }
}
