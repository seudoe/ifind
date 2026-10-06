import type { Internship } from "./internship";
import type { ApplicationStatus } from "./employer";

/** One of the student's applications. Student-safe: no employer notes, rating or user ids. */
export interface AppliedItem {
  internshipId: string;
  appliedAt: string;
  /** pipeline status; always "applied" when `tracked` is false */
  status: ApplicationStatus;
  /** true for iFind postings (the employer moves the application along); false for scraped ones */
  tracked: boolean;
  internship: Internship;
}

export interface TimelineEntry {
  status: ApplicationStatus;
  at: string;
}

export interface AppliedDetail extends AppliedItem {
  timeline: TimelineEntry[];
  coverLetter: string | null;
  answers: { question: string; answer: string }[];
  canWithdraw: boolean;
}

/** Happy path of an iFind application, in order. `rejected` and `withdrawn` end it early. */
export const PIPELINE_STAGES = ["applied", "under_review", "shortlisted", "interview", "offered", "hired"] as const;

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied", under_review: "Under review", shortlisted: "Shortlisted", interview: "Interview",
  offered: "Offered", hired: "Selected", rejected: "Not taken forward", withdrawn: "Withdrawn",
};

export const FINAL_STATUSES: readonly ApplicationStatus[] = ["hired", "rejected", "withdrawn"];
