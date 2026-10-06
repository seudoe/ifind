import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { notify } from "@/lib/employer/notify";
import type { InternshipInput } from "@/lib/employer/validation";
import Application from "@/models/Application";
import type { ICompany } from "@/models/Company";
import PlatformInternship, { type IPlatformInternship } from "@/models/PlatformInternship";
import type { InternshipStatus, PlatformInternship as InternshipDTO } from "@/types/employer";

export type InternshipDoc = HydratedDocument<IPlatformInternship>;

/** Editing any of these on a published internship sends it back to moderation. */
const MATERIAL = ["name", "stipend", "summary", "skills", "applyLink"] as const;

/** Employer-controlled lifecycle: draft -> published <-> paused -> closed -> archived. */
export const STATUS_TRANSITIONS: Record<string, { from: InternshipStatus[]; to: InternshipStatus }> = {
    pause: { from: ["published"], to: "paused" },
    close: { from: ["published", "paused"], to: "closed" },
    archive: { from: ["closed"], to: "archived" },
};

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** Client shape. Scam score/flags are internal to moderators, so only the outcome is exposed. */
export function toInternshipDTO(doc: InternshipDoc, applicantCount?: number): InternshipDTO {
    const o = JSON.parse(JSON.stringify(doc.toObject()));
    const m = o.moderation ?? {};
    o.moderation = {
        status: m.status,
        source: m.source,
        score: null,
        flags: [],
        reviewedAt: m.reviewedAt ?? null,
        rejectionReason: m.rejectionReason ?? null,
    };
    delete o.tfidf_vector;
    delete o.bert_vector;
    delete o.linkVerification;
    if (applicantCount !== undefined) o.applicantCount = applicantCount;
    return o;
}

export async function loadInternship(companyId: string, internshipId: string): Promise<InternshipDoc | NextResponse> {
    if (!mongoose.isValidObjectId(internshipId)) return fail("Internship not found", 404);
    // companyId in the query: an internship id from another company is simply not found
    const doc = await PlatformInternship.findOne({ _id: internshipId, companyId });
    return doc ?? fail("Internship not found", 404);
}

/** Deadline is inclusive: store the end of that day. */
function endOfDay(d?: Date | null): Date | null {
    if (!d) return null;
    const x = new Date(d);
    if (x.getUTCHours() === 0 && x.getUTCMinutes() === 0 && x.getUTCSeconds() === 0) x.setTime(x.getTime() + 86_400_000 - 1);
    return x;
}

const materialSnapshot = (doc: InternshipDoc) => JSON.stringify(MATERIAL.map((k) => doc.get(k) ?? null));

/**
 * Full replace of the employer-editable fields (the form always sends everything).
 * Returns true when a material field changed.
 */
export function applyInput(doc: InternshipDoc, i: InternshipInput, company: ICompany): boolean {
    const before = materialSnapshot(doc);

    doc.company = company.name;
    doc.name = i.name;
    doc.workMode = i.workMode;
    doc.country = i.country ?? null;
    doc.state = i.state ?? null;
    doc.city = i.city ?? null;
    doc.openings = i.openings ?? null;
    doc.startDate = i.startDate ?? null;
    doc.duration = i.duration;
    doc.hoursPerWeek = i.hoursPerWeek ?? null;
    doc.stipend = i.stipend && {
        type: i.stipend.type,
        amount: i.stipend.type === "paid" ? (i.stipend.amount ?? null) : null,
        currency: i.stipend.type === "paid" ? (i.stipend.currency ?? "INR") : null,
        period: i.stipend.type === "paid" ? (i.stipend.period ?? "monthly") : null,
    };
    doc.skills = i.skills;
    doc.degree = i.degree ?? null;
    doc.field = i.field ?? null;
    doc.experienceRequired = i.experienceRequired ? { min: i.experienceRequired.min ?? null, max: i.experienceRequired.max ?? null, unit: i.experienceRequired.unit } : null;
    doc.summary = i.summary ?? "";
    doc.responsibilities = i.responsibilities ?? null;
    doc.perks = i.perks ?? null;
    doc.whoCanApply = i.whoCanApply ?? null;
    doc.ppoAvailable = i.ppoAvailable;
    doc.certificate = i.certificate;
    doc.deadlineDate = endOfDay(i.deadlineDate);
    doc.requireResume = i.requireResume;
    doc.requireCoverLetter = i.requireCoverLetter;
    doc.maxApplications = i.maxApplications ?? null;
    doc.applyLink = i.applyLink ?? null;
    // Keep ids of existing questions so stored answers stay attached to them
    doc.set("screeningQuestions", i.screeningQuestions.map((q) => ({
        ...(q._id && mongoose.isValidObjectId(q._id) ? { _id: q._id } : {}),
        question: q.question, type: q.type, options: q.options, required: q.required,
    })));

    return before !== materialSnapshot(doc);
}

/** Back to the moderator queue (used after a material edit on a live listing). */
export function resetModeration(doc: InternshipDoc) {
    doc.moderation = { ...doc.moderation, status: "pending_review", score: null, flags: [], reviewedBy: null, reviewedAt: null, rejectionReason: null, scamDetails: null, source: "employer" };
}

/**
 * Moderation on publish. With no SCAM_DETECTOR_URL (or any detector failure) the listing goes to
 * a moderator, same as the scraper. An unverified company is never auto-approved.
 */
export async function runModeration(doc: InternshipDoc, companyVerified: boolean) {
    resetModeration(doc);
    const url = process.env.SCAM_DETECTOR_URL;
    if (!url) return;
    try {
        const res = await fetch(`${url.replace(/\/$/, "")}/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(15_000),
            body: JSON.stringify({
                _id: String(doc._id), name: doc.name, company: doc.company, applyLink: doc.applyLink, summary: doc.summary,
                city: doc.city, isRemote: doc.isRemote, stipend: doc.stipend, perks: doc.perks, skills: doc.skills, openings: doc.openings,
            }),
        });
        if (!res.ok) return;
        const r = await res.json();
        if (typeof r.scam_score !== "number" || !["clear", "review", "block"].includes(r.decision)) return;
        const status = r.decision === "block" ? "auto_rejected" : r.decision === "clear" && companyVerified ? "auto_approved" : "pending_review";
        doc.moderation.status = status;
        doc.moderation.score = r.scam_score;
        doc.moderation.flags = r.triggered_rules ?? [];
        doc.moderation.scamDetails = {
            score: r.scam_score, decision: r.decision, confidence: r.confidence ?? 0,
            explanationSummary: r.explanation_summary ?? "", scamFlags: r.triggered_rules ?? [], evaluatedAt: new Date(),
        };
    } catch (err) {
        console.error("[runModeration] detector failed, leaving pending_review", err);
    }
}

/**
 * Lazy auto-close (no cron): published/paused internships past their deadline or at maxApplications.
 * Each close is a conditional per-document update, so concurrent readers notify exactly once.
 */
export async function syncAutoClose(company: ICompany) {
    const now = new Date();
    const open = await PlatformInternship.find({ companyId: company._id, status: { $in: ["published", "paused"] } })
        .select("name deadlineDate maxApplications").lean();
    if (!open.length) return;

    const capped = open.filter((o) => o.maxApplications);
    const counts = capped.length
        ? await Application.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
            { $match: { internshipId: { $in: capped.map((o) => o._id) } } },
            { $group: { _id: "$internshipId", n: { $sum: 1 } } },
        ])
        : [];

    for (const o of open) {
        const pastDeadline = !!o.deadlineDate && o.deadlineDate < now;
        const full = !!o.maxApplications && (counts.find((c) => String(c._id) === String(o._id))?.n ?? 0) >= o.maxApplications;
        if (!pastDeadline && !full) continue;
        const closed = await PlatformInternship.findOneAndUpdate(
            { _id: o._id, status: { $in: ["published", "paused"] } },
            { $set: { status: "closed", closedAt: now } },
        );
        if (!closed) continue;
        await notify({
            recipientType: "employer",
            recipientIds: company.members.map((m) => m.employerId),
            type: "internship_deadline",
            title: `"${o.name}" was closed`,
            body: pastDeadline ? "The application deadline passed." : "It reached its maximum number of applications.",
            link: `/employer/company/${company._id}/internships/${o._id}/overview`,
            companyId: company._id,
        });
    }
}

