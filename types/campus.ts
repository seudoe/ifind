// Campus Internships: enums and shapes (single source of truth; models import these).

export const CAMPUS_ROLES = ["viewer", "coordinator", "admin", "owner"] as const;
export type CampusRole = (typeof CAMPUS_ROLES)[number];
export const CAMPUS_ROLE_RANK: Record<CampusRole, number> = { viewer: 1, coordinator: 2, admin: 3, owner: 4 };

export const CAMPUS_LISTINGS = ["listed", "code_only"] as const;
export type CampusListing = (typeof CAMPUS_LISTINGS)[number];

export const CAMPUS_RESTRICTIONS = ["none", "restricted", "banned"] as const;
export type CampusRestriction = (typeof CAMPUS_RESTRICTIONS)[number];

export const CAMPUS_REPORT_REASONS = ["not_official", "wrong_college", "scam", "other"] as const;
export type CampusReportReason = (typeof CAMPUS_REPORT_REASONS)[number];

export const CAMPUS_INTERNSHIP_STATUSES = ["draft", "open", "closed", "archived"] as const;
export type CampusInternshipStatus = (typeof CAMPUS_INTERNSHIP_STATUSES)[number];

export const CAMPUS_WORK_MODES = ["onsite", "remote", "hybrid"] as const;
export const CAMPUS_COMPANY_TIERS = ["dream", "super_dream", "normal"] as const;
export const CAMPUS_ROUND_TYPES = ["online_assessment", "group_discussion", "technical", "hr", "other"] as const;

export const CAMPUS_EVENT_TYPES = [
    "announcement", "instruction", "form", "pre_placement_talk", "online_assessment", "group_discussion",
    "technical_interview", "hr_interview", "result", "offer", "deadline", "other",
] as const;
export type CampusEventType = (typeof CAMPUS_EVENT_TYPES)[number];
export const CAMPUS_EVENT_MODES = ["online", "offline", "hybrid"] as const;
export const CAMPUS_EVENT_STATUSES = ["scheduled", "cancelled", "done"] as const;
/** Fixed audiences; `round:<name>` and `batch:<year>` are parsed from the string (see isEventAudience). */
export const CAMPUS_EVENT_AUDIENCES = ["all_members", "eligible", "applicants", "shortlisted"] as const;
export const isEventAudience = (a: string) => (CAMPUS_EVENT_AUDIENCES as readonly string[]).includes(a) || /^round:.{1,80}$/.test(a) || /^batch:\d{4}$/.test(a);

export const CAMPUS_APPLICATION_STATUSES = [
    "applied", "shortlisted", "in_process", "offered", "accepted", "declined", "rejected", "withdrawn", "removed",
] as const;
export type CampusApplicationStatus = (typeof CAMPUS_APPLICATION_STATUSES)[number];
export const CAMPUS_ROUND_RESULTS = ["pending", "cleared", "rejected", "absent"] as const;

/** Final statuses: the student is done with this application. Every other status is active and blocks leaving the entity. */
export const CAMPUS_FINAL_STATUSES: readonly CampusApplicationStatus[] = ["withdrawn", "rejected", "declined", "removed"];
export const CAMPUS_ACTIVE_STATUSES: readonly CampusApplicationStatus[] = CAMPUS_APPLICATION_STATUSES.filter((s) => !CAMPUS_FINAL_STATUSES.includes(s));
export const isActiveCampusStatus = (s: CampusApplicationStatus) => CAMPUS_ACTIVE_STATUSES.includes(s);

/** Staff-driven transitions (enforced server-side). Student actions (withdraw, accept, decline) are separate. */
export const CAMPUS_APPLICATION_TRANSITIONS: Record<CampusApplicationStatus, readonly CampusApplicationStatus[]> = {
    applied: ["shortlisted", "in_process", "rejected", "removed"],
    shortlisted: ["in_process", "offered", "rejected", "removed"],
    in_process: ["offered", "rejected", "removed"],
    offered: ["rejected", "removed"],
    accepted: ["removed"],
    declined: [],
    rejected: ["shortlisted", "removed"],
    withdrawn: [],
    removed: ["applied"], // reinstate
};

/** What a student may do to their own application. */
export const CAMPUS_STUDENT_TRANSITIONS: Record<CampusApplicationStatus, readonly CampusApplicationStatus[]> = {
    applied: ["withdrawn"],
    shortlisted: ["withdrawn"],
    in_process: ["withdrawn"],
    offered: ["accepted", "declined", "withdrawn"],
    accepted: ["withdrawn"], // needs the extra confirmation (route level)
    declined: [], rejected: [], withdrawn: [], removed: [],
};

export function canStaffTransition(from: CampusApplicationStatus, to: CampusApplicationStatus): boolean {
    return CAMPUS_APPLICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export const CAMPUS_NOTIFICATION_TYPES = [
    "campus_entity_created", "campus_internship", "campus_event", "campus_application_status", "campus_removed",
    "campus_banned", "campus_member_added", "campus_member_removed", "campus_member_role",
    "campus_new_applicant", "campus_withdrawal", "campus_offer_response", "campus_entity_reported", "campus_student_left",
    "campus_entity_closed",
] as const;

export const CAMPUS_JOIN_CODE_LENGTH = 8;

/** Shape of a document in the owner-populated, read-only `colleges` collection. Only `_id` and `name` are assumed. */
export interface CollegeDoc {
    _id: string;
    name: string;
    state?: string | null;
    city?: string | null;
    domains?: string[];
    website?: string | null;
}

export interface CampusEligibility {
    batches?: number[];
    courses?: string[];
    departments?: string[];
    minCgpa?: number | null;
    maxBacklogs?: number | null;
    other?: string | null;
}
