import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { checkImageUrls } from "@/lib/employer/upload";
import { companySchema, zodMessage } from "@/lib/employer/validation";
import PlatformInternship from "@/models/PlatformInternship";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
    const access = await requireCompanyRole((await params).companyId, "recruiter");
    if (isResponse(access)) return access;
    const { company, role } = access;
    return NextResponse.json({ success: true, data: { ...JSON.parse(JSON.stringify(company.toObject())), myRole: role } });
}

/** Edit profile: owner/admin. Slug, members and verification are never editable here. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "admin");
        if (isResponse(access)) return access;

        const parsed = companySchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        }
        const imgErr = checkImageUrls(parsed.data);
        if (imgErr) return NextResponse.json({ success: false, error: imgErr }, { status: 400 });

        const { company } = access;
        company.set(parsed.data);
        await company.save();

        // Keep the denormalised company name on its internships in sync
        await PlatformInternship.updateMany({ companyId: company._id }, { $set: { company: company.name } });
        return NextResponse.json({ success: true, data: { _id: String(company._id) } });
    } catch (error) {
        console.error("[employer/company PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to update company" }, { status: 500 });
    }
}

/** Soft delete: owner only, and only with no published/paused internships. Closes the rest. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "owner");
        if (isResponse(access)) return access;
        const { company } = access;

        const live = await PlatformInternship.countDocuments({ companyId: company._id, status: { $in: ["published", "paused"] } });
        if (live) {
            return NextResponse.json({ success: false, error: `Close ${live} published/paused internship(s) before deleting this company` }, { status: 409 });
        }
        await PlatformInternship.updateMany(
            { companyId: company._id, status: { $in: ["draft", "closed"] } },
            { $set: { status: "closed", closedAt: new Date() } },
        );
        company.deleteDetails = { deleted: true, deletedAt: new Date() };
        company.isActive = false;
        await company.save();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/company DELETE]", error);
        return NextResponse.json({ success: false, error: "Unable to delete company" }, { status: 500 });
    }
}
