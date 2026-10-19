/** Billed features and their credit cost per request. Settings in the database override these numbers. */
export const FEATURE_CREDITS = {
  chat: 1,
  rewrite: 1,
  star: 2,
  interview: 2,
  projects: 2,
  "job-description": 2,
  "career-roadmap": 3,
  "learning-roadmap": 3,
  "job-match": 5,
  "resume-analyze": 5,
  // Logged but outside the daily pool: gpt-4o resume parsing has its own monthly limit (lib/resumeParser.ts).
  "resume-parse": 0,
} as const;

export type FeatureKey = keyof typeof FEATURE_CREDITS;

export const FLAG_THRESHOLDS = {
  /** Hit the daily limit on at least this many of the last 7 days. */
  limitHitDays: 3,
  /** More than this many billed requests inside one minute. */
  burstPerMinute: 10,
  /** The same request body sent at least this many times in one day. */
  repeatedRequests: 5,
  /** Failed logins inside 24 hours. */
  failedLogins24h: 10,
  /** Applications inside any rolling hour. */
  applicationsPerHour: 30,
  /** Top share of users by cost, for this many days running. */
  topCostPercent: 1,
  topCostDays: 3,
};

export type FlagThresholds = typeof FLAG_THRESHOLDS;

export const DEFAULT_SETTINGS = {
  defaultDailyCredits: 40,
  systemDailyBudgetUsd: 3,
  featureCredits: { ...FEATURE_CREDITS } as Record<string, number>,
  flagThresholds: { ...FLAG_THRESHOLDS },
};

export type UsageSettings = typeof DEFAULT_SETTINGS;
