import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { listApplicants } from "@/lib/employer/applications";
import { loadInternship } from "@/lib/employer/internships";

export const runtime = "nodejs";

/** Applicants for one internship. ?status= &q= &sort=match|date|rating */
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    try {
        const { companyId, internshipId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        const internship = await loadInternship(companyId, internshipId);
        if (isResponse(internship)) return internship;

        const sp = request.nextUrl.searchParams;
        const data = await listApplicants({
            companyId: access.company._id,
            internshipId: internship._id,
            status: sp.get("status") ?? undefined,
            q: sp.get("q") ?? undefined,
            sort: sp.get("sort") ?? undefined,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("[employer/internship applications GET]", error);
        return NextResponse.json({ success: false, error: "Unable to load applicants" }, { status: 500 });
    }
}
