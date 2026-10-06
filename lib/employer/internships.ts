import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { notify } from "@/lib/employer/notify";
import { stripHtml } from "@/lib/employer/sanitize";
import type { InternshipInput } from "@/lib/employer/validation";
import { vectorizePlatformInternships } from "@/lib/internship-vectorizer";
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
export function applyInput(doc: InternshipDoc, input: InternshipInput, company: ICompany): boolean {
    const i = stripHtml(input);
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
    // The vectors describe the old text; they are recomputed when the listing is approved again
    doc.set({ tfidf_vector: null, bert_vector: null, vectorizedAt: null });
}

/** The raw shape internScraper's pipeline expects (see internScraper/pipeline.py _prepare_candidates). */
function toPipelineItem(doc: InternshipDoc) {
    const app = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    return {
        id: String(doc._id),
        name: doc.name,
        company: doc.company,
        // Employer listings have no external apply link; the pipeline needs a URL, so use the listing's own page
        applyLink: `${app}/internships/${doc._id}`,
        summary: doc.summary,
        location: doc.workMode === "remote" ? "Remote" : doc.city,
        city: doc.workMode === "remote" ? "Remote" : doc.city,
        state: doc.state, country: doc.country,
        skills: doc.skills, degree: doc.degree, field: doc.field,
        responsibilities: doc.responsibilities, perks: doc.perks, openings: doc.openings,
        stipend: doc.stipend, duration: doc.duration,
        deadline_date: doc.deadlineDate ? doc.deadlineDate.toISOString() : undefined,
    };
}

/**
 * Moderation on publish: run the listing through internScraper's pipeline (POST {INTERNSCRAPER_URL}/process),
 * the same validation + scam detection the scraped listings get. Scam-clear listings are auto-approved,
 * the grey band goes to a moderator, blocked ones are rejected. With no INTERNSCRAPER_URL, or on any failure,
 * the listing goes to a moderator (fail closed). An unverified company is never auto-approved.
 */
export async function runModeration(doc: InternshipDoc, companyVerified: boolean) {
    resetModeration(doc);
    const base = process.env.INTERNSCRAPER_URL;
    if (!base) return;
    try {
        const res = await fetch(`${base.replace(/\/$/, "")}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(process.env.INTERNSCRAPER_API_KEY ? { "x-api-key": process.env.INTERNSCRAPER_API_KEY } : {}) },
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({ source: "ifind", internship: toPipelineItem(doc) }),
        });
        if (!res.ok) {
            console.error("[runModeration] pipeline returned", res.status);
            return;
        }
        const r = (await res.json()).results?.[0];
        if (!r || r.outcome !== "scored" || !["auto_approved", "pending_review", "auto_rejected"].includes(r.moderationStatus)) return;

        const unverifiedClear = r.moderationStatus === "auto_approved" && !companyVerified;
        const flags: string[] = [...(r.flags ?? []), ...(unverifiedClear ? ["unverified_company"] : [])];
        doc.moderation.status = unverifiedClear ? "pending_review" : r.moderationStatus;
        doc.moderation.score = r.score;
        doc.moderation.flags = flags;
        doc.moderation.rejectionReason = r.moderationStatus === "auto_rejected" ? (r.rejectionReason ?? null) : null;
        doc.moderation.scamDetails = {
            score: r.scamDetails?.score ?? r.score,
            decision: r.decision,
            confidence: r.confidence ?? 0,
            explanationSummary: r.scamDetails?.explanationSummary ?? "",
            scamFlags: flags,
            evaluatedAt: new Date(),
            riskBreakdown: r.scamDetails?.riskBreakdown ?? null,
        };
    } catch (err) {
        console.error("[runModeration] pipeline unreachable, leaving pending_review", err);
    }
}

/**
 * Once a listing is approved (by the pipeline or a moderator): vectorize it and save the vectors onto the
 * document in 'internships.this-platform'. Fire-and-forget; nothing depends on it yet (student side later).
 */
export function vectorizeIfApproved(doc: InternshipDoc) {
    const approved = ["auto_approved", "manually_approved"].includes(doc.moderation.status);
    if (approved && doc.status !== "draft" && !doc.vectorizedAt) void vectorizePlatformInternships([String(doc._id)]);
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

