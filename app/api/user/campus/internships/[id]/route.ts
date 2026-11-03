import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isEligible } from "@/lib/campus/eligibility";
import { visibleToCampusStudentsFilter } from "@/lib/campus/internships";
import { getEnrollment } from "@/lib/campus/student";
import { requireStudent } from "@/lib/campus/studentAuth";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";

export const runtime = "nodejs";

/** One internship of the student's OWN campus with its screening questions (needed by the apply form). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const { id } = await params;
    const enrollment = await getEnrollment(me.userId);
    if (!enrollment?.entityId || !mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: "Internship not found" }, { status: 404 });
    const d = await CampusInternship.findOne({ _id: id, ...visibleToCampusStudentsFilter(enrollment.entityId) }).lean();
    if (!d) return NextResponse.json({ success: false, error: "Internship not found" }, { status: 404 });
    const verdict = isEligible(enrollment, d.eligibility);
    const mine = await CampusApplication.findOne({ internshipId: d._id, studentId: enrollment.userId }).select("status").lean();
    return NextResponse.json({
        success: true,
        data: {
            _id: String(d._id), company: d.company, designation: d.designation, description: d.description, requireResume: d.requireResume,
            deadlineDate: d.deadlineDate ?? null, eligible: verdict.ok, reasons: verdict.reasons, applicationStatus: mine?.status ?? null,
            screeningQuestions: d.screeningQuestions.map((q) => ({ _id: String(q._id), question: q.question, type: q.type, options: q.options, required: q.required })),
        },
    });
}
