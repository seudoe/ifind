import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { changeStatus } from "@/lib/employer/applications";
import { plainText } from "@/lib/employer/sanitize";
import { applicationStatusSchema, zodMessage } from "@/lib/employer/validation";
import Application from "@/models/Application";
import Employer from "@/models/Employer";
import PlatformInternship from "@/models/PlatformInternship";
import User from "@/models/User";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ companyId: string; applicationId: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** companyId is part of the query: an application id from another company is just "not found". */
async function findApplication(companyId: mongoose.Types.ObjectId, applicationId: string) {
    if (!mongoose.isValidObjectId(applicationId)) return null;
    return Application.findOne({ _id: applicationId, companyId });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
    try {
        const { companyId, applicationId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        const app = await findApplication(access.company._id, applicationId);
        if (!app) return fail("Application not found", 404);

        const [student, internship, authors] = await Promise.all([
            User.findById(app.studentId).select("name email phone city state profilePicture").lean(),
            PlatformInternship.findById(app.internshipId).select("name screeningQuestions").lean(),
            Employer.find({ _id: { $in: app.notes.map((n) => n.authorId) } }).select("name").lean(),
        ]);
        const o = JSON.parse(JSON.stringify(app.toObject()));
        o.notes = o.notes.map((n: { authorId: string }) => ({ ...n, authorName: authors.find((a) => String(a._id) === String(n.authorId))?.name ?? "Former member" }));
        return NextResponse.json({
            success: true,
            data: {
                application: o,
                student: student && { name: student.name, email: student.email, phone: student.phone ?? null, city: student.city ?? null, profilePicture: student.profilePicture ?? null },
                internship: internship && { name: internship.name, screeningQuestions: JSON.parse(JSON.stringify(internship.screeningQuestions ?? [])) },
            },
        });
    } catch (error) {
        console.error("[employer/application GET]", error);
        return fail("Unable to load application", 500);
    }
}

/** Body: { status?, rating?, note? }. A status change must follow the allowed-transition map. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const { companyId, applicationId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        const app = await findApplication(access.company._id, applicationId);
        if (!app) return fail("Application not found", 404);

        const parsed = applicationStatusSchema.safeParse(await request.json());
        if (!parsed.success) return fail(zodMessage(parsed.error), 400);
        const { status, rating, note } = parsed.data;
        if (status === undefined && rating === undefined) return fail("Nothing to update", 400);

        if (status !== undefined) {
            const r = await changeStatus(app, access.company._id, status, access.employer._id, note && plainText(note));
            if (!r.ok) return fail(r.error, r.status);
        }
        if (rating !== undefined) await Application.updateOne({ _id: app._id, companyId: access.company._id }, { $set: { rating } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/application PATCH]", error);
        return fail("Unable to update application", 500);
    }
}
