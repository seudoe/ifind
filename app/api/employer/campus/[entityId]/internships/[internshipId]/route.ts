import { NextRequest, NextResponse } from "next/server";
import { limitCampusWrite, campusPostingBlocked, requireCampusRole } from "@/lib/campus/access";
import { campusInternshipDraftSchema } from "@/lib/campus/internshipSchema";
import { EDITABLE, loadCampusInternship, syncCampusAutoClose, toCampusInternshipDTO } from "@/lib/campus/internships";
import { isResponse } from "@/lib/employer/access";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import { stripHtml } from "@/lib/employer/sanitize";
import { checkImageUrls } from "@/lib/employer/upload";
import { zodMessage } from "@/lib/employer/validation";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string; internshipId: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

export async function GET(_req: NextRequest, { params }: Ctx) {
    const { entityId, internshipId } = await params;
    const access = await requireCampusRole(entityId, "viewer");
    if (isResponse(access)) return access;
    await syncCampusAutoClose(access.entity._id);
    const doc = await loadCampusInternship(access.entity._id, internshipId);
    if (isResponse(doc)) return doc;
    const applicants = await CampusApplication.countDocuments({ entityId: access.entity._id, internshipId: doc._id });
    return NextResponse.json({ success: true, data: toCampusInternshipDTO(doc, applicants) });
}

/** Full replace of the editable fields. Draft and open internships only; closed and archived are read-only. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const { entityId, internshipId } = await params;
        const access = await requireCampusRole(entityId, "coordinator");
        if (isResponse(access)) return access;
        const limited = await hit("campus:draft-save", String(access.employer._id), RULES.campusDraftSave);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);
        const blocked = campusPostingBlocked(access.entity);
        if (blocked) return blocked;
        const doc = await loadCampusInternship(access.entity._id, internshipId);
        if (isResponse(doc)) return doc;
        if (!EDITABLE.includes(doc.status)) return fail(`A ${doc.status} internship is read-only. Duplicate it to post again.`, 409);

        const parsed = campusInternshipDraftSchema.safeParse(await request.json());
        if (!parsed.success) return fail(zodMessage(parsed.error), 400);
        const input = stripHtml(parsed.data);
        const imgErr = checkImageUrls({ logo: input.company.logo });
        if (imgErr) return fail(imgErr, 400);
        // An open internship must keep a future deadline: it is what students are told
        if (doc.status === "open" && !(input.deadlineDate instanceof Date)) return fail("An open internship needs an application deadline", 400);
        if (doc.status === "open" && input.deadlineDate && input.deadlineDate < new Date()) return fail("The application deadline is in the past", 400);

        doc.set(input);
        await doc.save();
        return NextResponse.json({ success: true, data: toCampusInternshipDTO(doc) });
    } catch (error) {
        console.error("[employer/campus/internship PATCH]", error);
        return fail("Unable to save internship", 500);
    }
}

/** Drafts only, and only when nobody applied (a draft cannot have applicants, but check anyway). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    try {
        const { entityId, internshipId } = await params;
        const access = await requireCampusRole(entityId, "coordinator");
        if (isResponse(access)) return access;
        const limited = await limitCampusWrite(access.employer._id);
        if (limited) return limited;
        const doc = await loadCampusInternship(access.entity._id, internshipId);
        if (isResponse(doc)) return doc;
        if (doc.status !== "draft") return fail("Only drafts can be deleted. Close or archive it instead.", 409);
        if (await CampusApplication.exists({ internshipId: doc._id })) return fail("This draft already has applications", 409);
        await CampusInternship.deleteOne({ _id: doc._id, entityId: access.entity._id, status: "draft" });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/campus/internship DELETE]", error);
        return fail("Unable to delete draft", 500);
    }
}
