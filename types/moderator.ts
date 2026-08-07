import type { Moderation, LinkVerification } from "./internship";
import type { ModeratorSession } from "@/lib/moderatorAuth";

// Re-export for convenience
export type { ModeratorSession };

export interface ModerationQueueItem {
    _id: string;
    name: string;
    company: string;
    applyLink: string;
    datePublished: string;
    source: string;
    moderation: Moderation;
    linkVerification?: LinkVerification;
    createdAt: string;
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
}

export interface ModeratorSummary {
    _id: string;
    name: string;
    email: string;
    isVerified: boolean;
    verifiedBy?: string | null;
    verifiedAt?: string | null;
    createdAt: string;
}
