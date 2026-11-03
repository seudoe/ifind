import { NextResponse } from "next/server";
import { isEligible } from "@/lib/campus/eligibility";
import { syncCampusAutoClose, visibleToCampusStudentsFilter } from "@/lib/campus/internships";
import { getEnrollment } from "@/lib/campus/student";
import { requireStudent } from "@/lib/campus/studentAuth";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";

export const runtime = "nodejs";

/**
 * Open internships of the student's OWN campus (the entity comes from their enrollment, never from the request), each
 * with an eligibility verdict. Staff-only fields (source text, who posted) are not returned.
 */
export async function GET() {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const enrollment = await getEnrollment(me.userId);
    if (!enrollment?.entityId) return NextResponse.json({ success: true, data: { items: [] } });

    await syncCampusAutoClose(enrollment.entityId);
    const docs = await CampusInternship.find(visibleToCampusStudentsFilter(enrollment.entityId)).sort({ deadlineDate: 1, createdAt: -1 }).limit(100).lean();
    const mine = await CampusApplication.find({ studentId: enrollment.userId, internshipId: { $in: docs.map((d) => d._id) } }).select("internshipId status").lean();
    const applied = new Map(mine.map((a) => [String(a.internshipId), a.status]));

    const items = docs.map((d) => {
        const verdict = isEligible(enrollment, d.eligibility);
        return {
            _id: String(d._id), company: d.company, designation: d.designation, description: d.description, workMode: d.workMode, locations: d.locations,
            deadlineDate: d.deadlineDate ?? null, assessmentDate: d.assessmentDate ?? null, interviewDate: d.interviewDate ?? null, resultDate: d.resultDate ?? null,
            startDate: d.startDate ?? null, duration: d.duration ?? null, stipend: d.stipend ?? null, openings: d.openings ?? null, ppoAvailable: d.ppoAvailable,
            skills: d.skills, rounds: d.rounds, eligibility: d.eligibility, eligible: verdict.ok, reasons: verdict.reasons, applicationStatus: applied.get(String(d._id)) ?? null,
        };
    });
    return NextResponse.json({ success: true, data: { items } });
}
