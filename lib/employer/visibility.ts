import type { QueryFilter } from "mongoose";
import type { IPlatformInternship } from "@/models/PlatformInternship";

/**
 * The one definition of "a student may see this employer-posted internship":
 * published by the employer, approved by moderation, active, and not past its deadline.
 * The student feed / apply API must use this instead of re-deriving it.
 */
export function visibleToStudentsFilter(now: Date = new Date()): QueryFilter<IPlatformInternship> {
    return {
        status: "published",
        "moderation.status": { $in: ["auto_approved", "manually_approved"] },
        isActive: true,
        bannedByCompany: { $ne: true },
        $or: [{ deadlineDate: null }, { deadlineDate: { $gt: now } }],
    };
}

/** Student-facing shape of a platform post: same fields as a scraped `Internship` plus the apply-flow fields. No vectors or moderation data. */
export function toStudentInternship<T extends Record<string, unknown>>(doc: T, logo?: string | null): Record<string, unknown> & { _id: unknown } {
    const { tfidf_vector, bert_vector, moderation, postedBy, linkVerification, ...rest } = doc;
    void tfidf_vector; void bert_vector; void moderation; void postedBy; void linkVerification;
    return { _id: doc._id, ...rest, applyLink: "", source: "ifind", companyLogo: logo ?? null };
}
