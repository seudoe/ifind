export interface Stipend {
  type: "paid" | "unpaid" | "performance-based";
  amount?: number | null;
  currency?: string | null;
  period?: "monthly" | "weekly" | "lump-sum" | null;
}

export interface Duration {
  value: number;
  unit: "weeks" | "months";
}

export interface ExperienceRequired {
  min?: number | null;
  max?: number | null;
  unit: "months" | "years";
}

export interface LinkVerification {
  reachable: boolean | null;
  statusCode?: number | null;
  redirectedTo?: string | null;
  isScamSuspected: boolean | null;
  isExpired: boolean | null;
  scamSignals: string[];
  checkedAt?: string | null;
  nextCheckAt?: string | null;
}

export interface Moderation {
  status: "auto_approved" | "pending_review" | "auto_rejected" | "manually_approved" | "manually_rejected";
  score: number | null;
  flags: string[];
  source: "web_scraping" | "api" | "user_contributed" | "email_parsing" | "rss" | "community_bot" | "manual";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}

export interface Internship {
  _id: string;
  name: string;
  company: string;
  applyLink: string;
  datePublished: string;
  deadlineDate?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  isRemote: boolean;
  stipend: Stipend;
  duration: Duration;
  skills: string[];
  degree?: string[] | null;
  field?: string[] | null;
  experienceRequired: ExperienceRequired | null;
  openings?: number | null;
  summary: string;
  responsibilities?: string[] | null;
  perks?: string[] | null;
  tags?: string[] | null;
  source?: string | null;
  isActive: boolean;
  fingerprint?: string | null;
  linkVerification?: LinkVerification;
  moderation?: Moderation;
  createdAt: string;
  updatedAt: string;
}

export interface InternshipFilters {
  stipendType: "any" | "paid" | "unpaid" | "performance-based";
  stipendMin: number;
  stipendMax: number;
  locations: string[];
  workFromHome: boolean;
  durationMin: number;
  durationMax: number;
  skills: string[];
  companies: string[];
  perks: string[];
  sortBy: "latest" | "deadline" | "stipend";
}
