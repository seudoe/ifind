import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { listApplicants } from "@/lib/employer/applications";
import PlatformInternship from "@/models/PlatformInternship";

export const runtime = "nodejs";

/** All applicants across the company's internships. ?internshipId= &status= &q= &sort=match|date|rating */
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
    try {
        const access = await requireCompanyRole((await params).companyId, "recruiter");
        if (isResponse(access)) return access;
        const sp = request.nextUrl.searchParams;

        const internshipId = sp.get("internshipId") || undefined;
        if (internshipId) {
            // The filter id must belong to this company, otherwise it's just "not found"
            if (!mongoose.isValidObjectId(internshipId) || !(await PlatformInternship.exists({ _id: internshipId, companyId: access.company._id }))) {
                return NextResponse.json({ success: false, error: "Internship not found" }, { status: 404 });
            }
        }
        const data = await listApplicants({
            companyId: access.company._id,
            internshipId,
            status: sp.get("status") ?? undefined,
            q: sp.get("q") ?? undefined,
            sort: sp.get("sort") ?? undefined,
        });
        const internships = await PlatformInternship.find({ companyId: access.company._id, status: { $ne: "draft" } }).select("name").sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: { ...data, internships: internships.map((i) => ({ _id: String(i._id), name: i.name })) } });
    } catch (error) {
        console.error("[employer/applications GET]", error);
        return NextResponse.json({ success: false, error: "Unable to load applicants" }, { status: 500 });
    }
}
