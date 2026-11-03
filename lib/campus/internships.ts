import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship, { type ICampusInternship } from "@/models/CampusInternship";
import type { QueryFilter } from "mongoose";
import type { CampusInternshipStatus } from "@/types/campus";

export type CampusInternshipDoc = HydratedDocument<ICampusInternship>;

/** Staff lifecycle: draft -> open -> closed -> archived. (Publishing also notifies students: Stage 8.) */
export const CAMPUS_STATUS_TRANSITIONS: Record<string, { from: CampusInternshipStatus[]; to: CampusInternshipStatus }> = {
    publish: { from: ["draft"], to: "open" },
    close: { from: ["open"], to: "closed" },
    archive: { from: ["closed"], to: "archived" },
};

/** Statuses whose content staff can still edit. Closed and archived are read-only; duplicate to post again. */
export const EDITABLE: CampusInternshipStatus[] = ["draft", "open"];

/**
 * The one definition of "a joined student may see this campus internship": open and not past its deadline (the apply
 * and list routes use this, like visibleToStudentsFilter for company posts). Always combined with the student's own entityId.
 */
export function visibleToCampusStudentsFilter(entityId: unknown, now: Date = new Date()): QueryFilter<ICampusInternship> {
    return {
        entityId: entityId as mongoose.Types.ObjectId,
        status: "open",
        $or: [{ deadlineDate: null }, { deadlineDate: { $gt: now } }],
    };
}

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** Loads an internship that belongs to the entity (never trust the id alone). */
export async function loadCampusInternship(entityId: unknown, internshipId: string): Promise<CampusInternshipDoc | NextResponse> {
    if (!mongoose.isValidObjectId(internshipId)) return fail("Internship not found", 404);
    const doc = await CampusInternship.findOne({ _id: internshipId, entityId: entityId as mongoose.Types.ObjectId });
    return doc ?? fail("Internship not found", 404);
}

/** Client shape. Dates stay ISO strings. */
export function toCampusInternshipDTO(doc: CampusInternshipDoc, applicantCount?: number) {
    return { ...JSON.parse(JSON.stringify(doc.toObject())), ...(applicantCount === undefined ? {} : { applicantCount }) };
}

/**
 * Lazy auto-close (no scheduler): open internships past their deadline, or full (`maxApplications` reached), become
 * closed. Called by the list/detail/layout reads and the student reads. Returns the ids it closed.
 */
export async function syncCampusAutoClose(entityId: unknown): Promise<mongoose.Types.ObjectId[]> {
    const now = new Date();
    const open = await CampusInternship.find({ entityId: entityId as mongoose.Types.ObjectId, status: "open" }).select("deadlineDate maxApplications").lean();
    if (!open.length) return [];
    const capped = open.filter((o) => o.maxApplications);
    const counts = capped.length
        ? await CampusApplication.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
            { $match: { internshipId: { $in: capped.map((o) => o._id) }, status: { $ne: "withdrawn" } } },
            { $group: { _id: "$internshipId", n: { $sum: 1 } } },
        ])
        : [];
    const closedIds: mongoose.Types.ObjectId[] = [];
    for (const o of open) {
        const pastDeadline = !!o.deadlineDate && o.deadlineDate < now;
        const full = !!o.maxApplications && (counts.find((c) => String(c._id) === String(o._id))?.n ?? 0) >= o.maxApplications;
        if (!pastDeadline && !full) continue;
        const res = await CampusInternship.updateOne({ _id: o._id, status: "open" }, { $set: { status: "closed", closedAt: now } });
        if (res.modifiedCount === 1) closedIds.push(o._id);
    }
    return closedIds;
}

/** Applicant counts per internship (all statuses). */
export async function applicantCounts(entityId: unknown): Promise<Map<string, number>> {
    const rows = await CampusApplication.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
        { $match: { entityId: entityId as mongoose.Types.ObjectId } },
        { $group: { _id: "$internshipId", n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.n]));
}

/** Copy for "duplicate": new draft, no dates that are now in the past, no source text link to applicants. */
export function duplicateFields(doc: CampusInternshipDoc, postedBy: mongoose.Types.ObjectId): Partial<ICampusInternship> {
    const o = doc.toObject();
    return {
        ...o,
        _id: undefined, createdAt: undefined, updatedAt: undefined, __v: undefined,
        designation: `${o.designation} (copy)`.slice(0, 150),
        postedBy,
        status: "draft" as const,
        closedAt: null,
        emailedAt: null,
        deadlineDate: null,
        screeningQuestions: o.screeningQuestions.map((q) => ({ question: q.question, type: q.type, options: q.options, required: q.required })),
    } as unknown as Partial<ICampusInternship>;
}
