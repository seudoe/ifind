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
  city?: string | null;
  state?: string | null;
  country?: string | null;
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
