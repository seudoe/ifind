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
        $or: [{ deadlineDate: null }, { deadlineDate: { $gt: now } }],
    };
}
