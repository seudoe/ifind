import type { FlagThresholds } from "./config";

/** What the flag rules look at for one user. Everything here is computed from the usage and login records. */
export interface UserMetrics {
  /** Days in the last 7 on which the daily limit was hit. */
  limitHitDays7: number;
  /** Most billed requests inside any one minute in the last 24 hours (blocked ones count). */
  maxRequestsPerMinute: number;
  /** Most times the same request body was sent in the last 24 hours. */
  maxRepeatedRequests: number;
  failedLogins24h: number;
  maxApplicationsPerHour: number;
  /** Most recent consecutive days on which the user was in the top share by cost. */
  topCostStreak: number;
}

export interface Flag {
  code: "limit_repeated" | "burst" | "repeated_requests" | "failed_logins" | "application_burst" | "top_cost";
  label: string;
  detail: string;
}

export function buildFlags(m: UserMetrics, t: FlagThresholds): Flag[] {
  const flags: Flag[] = [];
  if (m.limitHitDays7 >= t.limitHitDays) {
    flags.push({ code: "limit_repeated", label: "Keeps hitting the daily limit", detail: `Hit the limit on ${m.limitHitDays7} of the last 7 days` });
  }
  if (m.maxRequestsPerMinute > t.burstPerMinute) {
    flags.push({ code: "burst", label: "Request bursts", detail: `${m.maxRequestsPerMinute} billed requests in one minute (limit ${t.burstPerMinute})` });
  }
  if (m.maxRepeatedRequests >= t.repeatedRequests) {
    flags.push({ code: "repeated_requests", label: "Repeated identical requests", detail: `The same request sent ${m.maxRepeatedRequests} times in 24 hours` });
  }
  if (m.failedLogins24h >= t.failedLogins24h) {
    flags.push({ code: "failed_logins", label: "Many failed logins", detail: `${m.failedLogins24h} failed logins in 24 hours` });
  }
  if (m.maxApplicationsPerHour > t.applicationsPerHour) {
    flags.push({ code: "application_burst", label: "Application spree", detail: `${m.maxApplicationsPerHour} applications in one hour (limit ${t.applicationsPerHour})` });
  }
  if (m.topCostStreak >= t.topCostDays) {
    flags.push({ code: "top_cost", label: "Among the highest-cost users", detail: `In the top ${t.topCostPercent}% by cost for ${m.topCostStreak} days running` });
  }
  return flags;
}

/** Largest number of timestamps (ms) that fall inside any window of `windowMs`. */
export function maxInRollingWindow(timestamps: number[], windowMs: number): number {
  const sorted = [...timestamps].sort((a, b) => a - b);
  let best = 0;
  let start = 0;
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end] - sorted[start] >= windowMs) start++;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

/**
 * Whether each day (newest first) had the user among the top `percent` of spenders. Needs `minUsers` active
 * users that day to rank at all, so one heavy user in a quiet week isn't flagged just for being first.
 */
export function topCostStreak(
  days: Array<{ costs: Array<{ subject: string; costUsd: number }> }>,
  subject: string,
  percent: number,
  minUsers = 20,
): number {
  let streak = 0;
  for (const day of days) {
    const ranked = day.costs.filter((c) => c.costUsd > 0).sort((a, b) => b.costUsd - a.costUsd);
    if (ranked.length < minUsers) break;
    const topN = Math.max(1, Math.ceil((ranked.length * percent) / 100));
    if (!ranked.slice(0, topN).some((c) => c.subject === subject)) break;
    streak++;
  }
  return streak;
}
