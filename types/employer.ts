import type { Duration, ExperienceRequired, Moderation, Stipend } from "./internship";

// ── Enums (single source of truth; models import these) ─────────────────────
export const COMPANY_TYPES = ["startup", "private", "public", "mnc", "ngo", "government", "educational", "other"] as const;
export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"] as const;
export const MEMBER_ROLES = ["owner", "admin", "recruiter"] as const;
export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export const INTERNSHIP_STATUSES = ["draft", "published", "paused", "closed", "archived"] as const;
export const WORK_MODES = ["onsite", "remote", "hybrid"] as const;
export const QUESTION_TYPES = ["text", "yes_no", "single_choice", "multi_choice", "number"] as const;
export const APPLICATION_STATUSES = [
    "applied", "under_review", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn",
] as const;
export const NOTIFICATION_TYPES = [
    "new_application", "application_withdrawn", "internship_approved", "internship_rejected",
    "internship_deadline", "company_verification", "company_member_added", "system",
] as const;
export const RECIPIENT_TYPES = ["student", "employer", "moderator"] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];
export type CompanySize = (typeof COMPANY_SIZES)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type InternshipStatus = (typeof INTERNSHIP_STATUSES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

/** Allowed employer-driven transitions (enforced server-side). */
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
    applied: ["under_review", "shortlisted", "rejected"],
    under_review: ["shortlisted", "rejected"],
    shortlisted: ["interview", "offered", "rejected"],
    interview: ["offered", "rejected"],
    offered: ["hired", "rejected"],
    rejected: ["under_review"],
    hired: [],
    withdrawn: [],
};

/** Role rank: higher = more privilege. */
export const ROLE_RANK: Record<MemberRole, number> = { recruiter: 1, admin: 2, owner: 3 };

// ── Client-facing shapes (ids/dates as string) ──────────────────────────────
export interface EmployerSession {
    employerId: string;
    email: string;
    name: string;
    role: "employer";
}

export interface Employer {
    _id: string;
    name: string;
    email: string;
    isEmailVerified: boolean;
    hasPassword: boolean;
    linkedinLinked: boolean;
    profilePicture?: string | null;
    phone?: string | null;
    designation?: string | null;
    role: "employer";
    isBanned: boolean;
    lastLoginAt?: string | null;
    createdAt: string;
}

export interface CompanyAddress {
    line1?: string | null;
    line2?: string | null;
    city: string;
    state?: string | null;
    country: string;
    pincode?: string | null;
}

export interface CompanyMember {
    employerId: string;
    role: MemberRole;
    addedBy?: string | null;
    addedAt: string;
    name?: string;
    email?: string;
}

export interface Company {
    _id: string;
    name: string;
    slug: string;
    legalName?: string | null;
    tagline?: string | null;
    description: string;
    logo?: string | null;
    coverImage?: string | null;
    website?: string | null;
    industry: string;
    companyType: CompanyType;
    size: CompanySize;
    foundedYear?: number | null;
    headquarters: CompanyAddress;
    officeLocations: string[];
    contactEmail: string;
    contactPhone?: string | null;
    socials: { linkedin?: string | null; twitter?: string | null; instagram?: string | null; github?: string | null };
    registration: { gstin?: string | null; cin?: string | null; pan?: string | null };
    perks: string[];
    techStack: string[];
    members: CompanyMember[];
    createdBy: string;
    verification: {
        status: VerificationStatus;
        submittedAt?: string | null;
        reviewedBy?: string | null;
        reviewedAt?: string | null;
        rejectionReason?: string | null;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Company card for the companies list. */
export interface CompanySummary {
    _id: string;
    name: string;
    logo?: string | null;
    verificationStatus: VerificationStatus;
    role: MemberRole;
    publishedInternships: number;
    newApplicants: number;
}

export interface ScreeningQuestion {
    _id?: string;
    question: string;
    type: QuestionType;
    options: string[];
    required: boolean;
}

export interface PlatformInternship {
    _id: string;
    companyId: string;
    postedBy: string;
    name: string;
    company: string;
    applyLink: string | null;
    status: InternshipStatus;
    workMode: WorkMode;
    isRemote: boolean;
    country?: string | null;
    state?: string | null;
    city?: string | null;
    datePublished?: string | null;
    deadlineDate?: string | null;
    startDate?: string | null;
    hoursPerWeek?: number | null;
    ppoAvailable: boolean;
    certificate: boolean;
    whoCanApply?: string | null;
    stipend?: Stipend | null;
    duration?: Duration | null;
    skills: string[];
    degree?: string[] | null;
    field?: string[] | null;
    experienceRequired?: ExperienceRequired | null;
    openings?: number | null;
    summary: string;
    responsibilities?: string[] | null;
    perks?: string[] | null;
    screeningQuestions: ScreeningQuestion[];
    requireResume: boolean;
    requireCoverLetter: boolean;
    maxApplications?: number | null;
    closedAt?: string | null;
    isActive: boolean;
    moderation: Moderation;
    applicantCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface StatusHistoryEntry {
    status: ApplicationStatus;
    changedBy?: string | null;
    changedAt: string;
    note?: string | null;
}

export interface ApplicationNote {
    _id: string;
    authorId: string;
    authorName?: string;
    text: string;
    createdAt: string;
}

/** Employer-only application shape. Contains notes/rating: never reuse on the student side. */
export interface EmployerApplication {
    _id: string;
    internshipId: string;
    companyId: string;
    studentId: string;
    status: ApplicationStatus;
    statusHistory: StatusHistoryEntry[];
    resumeSnapshot: { url?: string | null; parsedData?: unknown; skills: string[] };
    coverLetter?: string | null;
    answers: { questionId: string; answer: unknown }[];
    matchScore?: number | null;
    rating?: number | null;
    notes: ApplicationNote[];
    appliedAt: string;
}

/** Row in the ATS table. */
export interface ApplicantSummary {
    _id: string;
    internshipId: string;
    internshipName?: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;
    studentPicture?: string | null;
    skills: string[];
    matchScore?: number | null;
    status: ApplicationStatus;
    rating?: number | null;
    appliedAt: string;
}

export interface AppNotification {
    _id: string;
    recipientType: RecipientType;
    recipientId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
    companyId?: string | null;
    readAt?: string | null;
    createdAt: string;
}
