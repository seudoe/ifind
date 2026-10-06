import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { applyInput, loadInternship, runModeration, syncAutoClose, toInternshipDTO, vectorizeIfApproved } from "@/lib/employer/internships";
import { internshipDraftSchema, zodMessage } from "@/lib/employer/validation";
import Application from "@/models/Application";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ companyId: string; internshipId: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

export async function GET(_req: NextRequest, { params }: Ctx) {
    try {
        const { companyId, internshipId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;

        await syncAutoClose(access.company);
        const doc = await loadInternship(companyId, internshipId);
        if (isResponse(doc)) return doc;
        const n = await Application.countDocuments({ internshipId: doc._id, companyId: access.company._id });
        return NextResponse.json({ success: true, data: toInternshipDTO(doc, n) });
    } catch (error) {
        console.error("[employer/internship GET]", error);
        return fail("Unable to load internship", 500);
    }
}

/**
 * Edit (full replace of the form fields). Material edits on a live listing re-trigger moderation.
 * Closed/archived internships are read-only.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const { companyId, internshipId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        const doc = await loadInternship(companyId, internshipId);
        if (isResponse(doc)) return doc;

        if (!["draft", "published", "paused"].includes(doc.status)) return fail(`This ${doc.status} internship can't be edited. Duplicate it instead.`, 409);

        const parsed = internshipDraftSchema.safeParse(await request.json());
        if (!parsed.success) return fail(zodMessage(parsed.error), 400);

        const materialChange = applyInput(doc, parsed.data, access.company);
        const sentBack = materialChange && doc.status !== "draft";
        // Key details changed on a live listing: back through the pipeline (may auto-approve again)
        if (sentBack) await runModeration(doc, access.company.verification?.status === "verified");
        await doc.save();
        if (sentBack) vectorizeIfApproved(doc);
        return NextResponse.json({ success: true, data: toInternshipDTO(doc), sentBackToModeration: sentBack });
    } catch (error) {
        console.error("[employer/internship PATCH]", error);
        return fail("Unable to update internship", 500);
    }
}

/** Drafts with no applications only. Everything else must be closed or archived. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    try {
        const { companyId, internshipId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        const doc = await loadInternship(companyId, internshipId);
        if (isResponse(doc)) return doc;

        if (doc.status !== "draft") return fail("Only drafts can be deleted. Close or archive this internship instead.", 409);
        if (await Application.exists({ internshipId: doc._id })) return fail("This internship has applications and can't be deleted", 409);
        await doc.deleteOne();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/internship DELETE]", error);
        return fail("Unable to delete internship", 500);
    }
}
