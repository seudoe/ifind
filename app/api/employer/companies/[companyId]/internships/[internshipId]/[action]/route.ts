import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { loadInternship, resetModeration, runModeration, STATUS_TRANSITIONS, toInternshipDTO, vectorizeIfApproved } from "@/lib/employer/internships";
import { internshipPublishSchema, zodMessage } from "@/lib/employer/validation";
import PlatformInternship from "@/models/PlatformInternship";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ companyId: string; internshipId: string; action: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** Drop nulls so the stored doc validates against the optional-field zod schema. */
function stripNulls(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stripNulls);
    if (v && typeof v === "object") {
        return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNulls(x)]));
    }
    return v;
}

/** POST .../[action]: publish | pause | close | archive | duplicate */
export async function POST(_req: NextRequest, { params }: Ctx) {
    try {
        const { companyId, internshipId, action } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        const doc = await loadInternship(companyId, internshipId);
        if (isResponse(doc)) return doc;

        if (action === "duplicate") {
            const o = doc.toObject();
            const copy = new PlatformInternship({
                ...o,
                _id: undefined, createdAt: undefined, updatedAt: undefined, __v: undefined,
                name: `${o.name} (copy)`.slice(0, 150),
                postedBy: access.employer._id,
                status: "draft",
                datePublished: null,
                closedAt: null,
                screeningQuestions: o.screeningQuestions.map((q) => ({ question: q.question, type: q.type, options: q.options, required: q.required })),
            });
            resetModeration(copy);
            await copy.save();
            return NextResponse.json({ success: true, data: toInternshipDTO(copy, 0) }, { status: 201 });
        }

        if (action === "publish") {
            if (doc.status !== "draft" && doc.status !== "paused") return fail(`A ${doc.status} internship can't be published`, 409);

            const check = internshipPublishSchema.safeParse(stripNulls(JSON.parse(JSON.stringify(doc.toObject()))));
            if (!check.success) return fail(zodMessage(check.error), 400);
            if (doc.deadlineDate && doc.deadlineDate < new Date()) return fail("The application deadline is in the past", 400);

            if (doc.status === "draft") {
                doc.datePublished = doc.datePublished ?? new Date();
                await runModeration(doc, access.company.verification?.status === "verified");
            } // resuming from pause keeps the existing moderation result
            doc.status = "published";
            doc.closedAt = null;
            await doc.save();
            vectorizeIfApproved(doc);
            return NextResponse.json({ success: true, data: toInternshipDTO(doc) });
        }

        const t = STATUS_TRANSITIONS[action];
        if (!t) return fail("Unknown action", 404);
        if (!t.from.includes(doc.status)) return fail(`Can't ${action} a ${doc.status} internship`, 409);
        doc.status = t.to;
        if (t.to === "closed") doc.closedAt = new Date();
        await doc.save();
        return NextResponse.json({ success: true, data: toInternshipDTO(doc) });
    } catch (error) {
        console.error("[employer/internship action]", error);
        return fail("Action failed", 500);
    }
}
