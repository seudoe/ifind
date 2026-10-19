import type { Moderation, LinkVerification } from "./internship";
import type { ModeratorSession } from "@/lib/moderatorAuth";

// Re-export for convenience
export type { ModeratorSession };

export interface ModerationQueueItem {
    _id: string;
    name: string;
    company: string;
    /** null for employer-posted listings (applications happen on iFind) */
    applyLink: string | null;
    datePublished: string;
    source: string;
    moderation: Moderation;
    linkVerification?: LinkVerification;
    createdAt: string;
    priority: number;
    /** Employer-posted listings only */
    employer?: { companyVerified: boolean; summary: string; skills: string[] };
}

export interface UserSummary {
    _id: string;
    name: string;
    username: string;
    email: string;
    profilePicture?: string | null;
    createdAt: string;
    applicationCount: number;
    isBanned: boolean;
    bannedReason?: string | null;
    bannedBy?: string | null;
    bannedAt?: string | null;
    lastLoginAt?: string | null;
    dailyCreditLimit?: number | null;
    flags?: Array<{ code: string; label: string; detail: string }>;
}

export interface EmployerSummary {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string | null;
    phone?: string | null;
    designation?: string | null;
    isEmailVerified: boolean;
    createdAt: string;
    lastLoginAt?: string | null;
    isBanned: boolean;
    bannedReason?: string | null;
    bannedAt?: string | null;
    companyCount: number;
}

export interface ModeratorSummary {
    _id: string;
    name: string;
    email: string;
    isVerified: boolean;
    verifiedBy?: { _id: string; name: string } | string | null;
    verifiedAt?: string | null;
    createdAt: string;
    priority: number;
    isBanned: boolean;
    bannedBy?: string | null;
    bannedAt?: string | null;
    bannedReason?: string | null;
}
