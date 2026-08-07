import type { Resume } from "./resume";

export interface AppliedInternship {
    internshipId: string;
    appliedAt: string;
    status: "applied" | "shortlisted" | "rejected" | "selected";
}

export interface RecommendationScore {
    id: string;
    score: number;
}

export interface LinkedInProfile {
    sub: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    email_verified?: boolean;
    picture?: string;
    locale?: any;
}

export interface User {
    _id: string;
    name: string;
    username: string;
    email: string;
    linkedinId?: string | null;
    linkedinDetails?: LinkedInProfile | null;
    role?: "user" | "admin";
    profilePicture?: string | null;
    phone?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    skills?: string[];
    resume: Resume;

    // internships related
    appliedInternships: AppliedInternship[];
    savedInternships: string[];
    recommendedInternships?: {
        updatedAt: string;
        recommendedList: string[];
        recommendedScores: RecommendationScore[];
    };
    profileCompletionScore: number;

    // account related
    createdAt: string;
    updatedAt: string;
    deleteDetails?: {
        deleted?: boolean | null;
        deletedAt?: string;
    };

    // resume extraction quota
    aiExtractionUsedThisMonth?: number;
    aiExtractionMonthYear?: string | null;
}

// OLD -----------------
/*
import type { Resume } from "./resume";

export interface AppliedInternship {
  internshipId: string;
  appliedAt: string;
  status: "applied" | "shortlisted" | "rejected" | "selected";
}

export interface RecommendationScore {
  id: string;
  score: number;
}

export interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  role?: "user" | "admin";
  profilePicture?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  skills?: string[];
  resume: Resume;
  appliedInternships: AppliedInternship[];
  savedInternships: string[];
  recommendedInternships?: string[];
  recommendedScores?: RecommendationScore[];
  recommendedUpdatedAt?: string | null;
  profileCompletionScore: number;
  createdAt: string;
  updatedAt: string;
}
*/
