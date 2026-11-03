import { NextRequest, NextResponse } from "next/server";
import { campusPostingBlocked, requireCampusRole } from "@/lib/campus/access";
import { campusInternshipPublishSchema } from "@/lib/campus/internshipSchema";
import { CAMPUS_STATUS_TRANSITIONS, duplicateFields, loadCampusInternship, syncCampusAutoClose, toCampusInternshipDTO } from "@/lib/campus/internships";
import { isResponse } from "@/lib/employer/access";
import { zodMessage } from "@/lib/employer/validation";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import CampusInternship from "@/models/CampusInternship";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string; internshipId: string; action: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** Drop nulls so the stored doc validates against the optional-field zod schema. */
function stripNulls(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stripNulls);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNulls(x)]));
    return v;
}

/** POST .../[action]: publish | close | archive | duplicate. Coordinator and up. */
export async function POST(_req: NextRequest, { params }: Ctx) {
    try {
        const { entityId, internshipId, action } = await params;
        const access = await requireCampusRole(entityId, "coordinator");
        if (isResponse(access)) return access;
        if (action === "duplicate" || action === "publish") {
            const blocked = campusPostingBlocked(access.entity);
            if (blocked) return blocked;
            const limited = await hit("campus:internship-write", String(access.employer._id), RULES.employerWrite);
            if (!limited.ok) return tooManyRequests(limited.retryAfter);
        }
        await syncCampusAutoClose(access.entity._id);
        const doc = await loadCampusInternship(access.entity._id, internshipId);
        if (isResponse(doc)) return doc;

        if (action === "duplicate") {
            const copy = await CampusInternship.create(duplicateFields(doc, access.employer._id));
            return NextResponse.json({ success: true, data: toCampusInternshipDTO(copy, 0) }, { status: 201 });
        }

        const t = CAMPUS_STATUS_TRANSITIONS[action];
        if (!t) return fail("Unknown action", 404);
        if (!t.from.includes(doc.status)) return fail(`Can't ${action} a ${doc.status} internship`, 409);

        if (action === "publish") {
            const raw = JSON.parse(JSON.stringify(doc.toObject()));
            const check = campusInternshipPublishSchema.safeParse(stripNulls(raw));
            if (!check.success) return fail(zodMessage(check.error), 400);
            if (doc.deadlineDate && doc.deadlineDate < new Date()) return fail("The application deadline is in the past", 400);
        }

        // Conditional update: two coordinators acting at once cannot both transition it
        const res = await CampusInternship.updateOne(
            { _id: doc._id, entityId: access.entity._id, status: { $in: t.from } },
            { $set: { status: t.to, closedAt: t.to === "closed" ? new Date() : doc.closedAt ?? null } },
        );
        if (res.modifiedCount !== 1) return fail("This internship was just changed by someone else. Reload and try again.", 409);
        const updated = await CampusInternship.findById(doc._id);
        return NextResponse.json({ success: true, data: toCampusInternshipDTO(updated!) });
    } catch (error) {
        console.error("[employer/campus/internship action]", error);
        return fail("Action failed", 500);
    }
}
