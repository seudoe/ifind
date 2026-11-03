import { NextRequest, NextResponse } from "next/server";
import { campusPostingBlocked, requireCampusRole } from "@/lib/campus/access";
import { campusInternshipDraftSchema } from "@/lib/campus/internshipSchema";
import { applicantCounts, syncCampusAutoClose, toCampusInternshipDTO } from "@/lib/campus/internships";
import { isResponse } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";
import { checkImageUrls } from "@/lib/employer/upload";
import { zodMessage } from "@/lib/employer/validation";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import CampusInternship from "@/models/CampusInternship";
import { CAMPUS_INTERNSHIP_STATUSES } from "@/types/campus";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string }> };

const MAX_PER_ENTITY = 500;

/** Viewer and up. ?status= filters; counts are always for the whole campus. */
export async function GET(request: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    const { entity } = access;
    await syncCampusAutoClose(entity._id);

    const status = request.nextUrl.searchParams.get("status");
    const filter: Record<string, unknown> = { entityId: entity._id };
    if (status && (CAMPUS_INTERNSHIP_STATUSES as readonly string[]).includes(status)) filter.status = status;

    const [docs, grouped, applicants] = await Promise.all([
        CampusInternship.find(filter).sort({ createdAt: -1 }).limit(200),
        CampusInternship.aggregate<{ _id: string; n: number }>([{ $match: { entityId: entity._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
        applicantCounts(entity._id),
    ]);
    return NextResponse.json({
        success: true,
        data: {
            items: docs.map((d) => toCampusInternshipDTO(d, applicants.get(String(d._id)) ?? 0)),
            counts: Object.fromEntries(grouped.map((g) => [g._id, g.n])),
        },
    });
}

/** Creates a draft. Coordinator and up. Only the company and the designation are required. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "coordinator");
        if (isResponse(access)) return access;
        const blocked = campusPostingBlocked(access.entity);
        if (blocked) return blocked;
        const limited = await hit("campus:internship-write", String(access.employer._id), RULES.employerWrite);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);

        const parsed = campusInternshipDraftSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const input = stripHtml(parsed.data);
        const imgErr = checkImageUrls({ logo: input.company.logo });
        if (imgErr) return NextResponse.json({ success: false, error: imgErr }, { status: 400 });
        if ((await CampusInternship.countDocuments({ entityId: access.entity._id })) >= MAX_PER_ENTITY) {
            return NextResponse.json({ success: false, error: `A campus can have at most ${MAX_PER_ENTITY} internships. Archive or delete old drafts.` }, { status: 400 });
        }

        const doc = await CampusInternship.create({
            ...input,
            entityId: access.entity._id,
            collegeId: access.entity.collegeId,
            postedBy: access.employer._id,
            status: "draft",
        });
        return NextResponse.json({ success: true, data: toCampusInternshipDTO(doc, 0) }, { status: 201 });
    } catch (error) {
        console.error("[employer/campus/internships POST]", error);
        return NextResponse.json({ success: false, error: "Unable to save internship" }, { status: 500 });
    }
}
