import type { ScrapeRun, ScrapeSource } from "@/types/scrape";

export const HIST_KEYS = Array.from({ length: 10 }, (_, i) => `${i * 10}-${i * 10 + 10}`);

export interface Agg {
    scraped: number;
    saved: number;
    duplicate: number;
    rejected: number;
    errors: number;
    approved: number;
    pending: number;
    blocked: number;
    flagged: number; // pending + blocked
    hist: number[];
    rules: Record<string, number>;
    seconds: number;
    failedSources: number;
    sources: number;
}

const n = (v: number | undefined | null) => v ?? 0;

export function aggregate(sources: ScrapeSource[]): Agg {
    const a: Agg = {
        scraped: 0, saved: 0, duplicate: 0, rejected: 0, errors: 0,
        approved: 0, pending: 0, blocked: 0, flagged: 0,
        hist: new Array(10).fill(0), rules: {}, seconds: 0, failedSources: 0, sources: sources.length,
    };
    for (const s of sources) {
        a.scraped += n(s.scraped); a.saved += n(s.saved); a.duplicate += n(s.duplicate);
        a.rejected += n(s.rejected); a.errors += n(s.errors);
        a.approved += n(s.statusCounts?.auto_approved);
        a.pending += n(s.statusCounts?.pending_review);
        a.blocked += n(s.statusCounts?.auto_rejected);
        HIST_KEYS.forEach((k, i) => (a.hist[i] += n(s.scoreHistogram?.[k])));
        for (const [r, c] of Object.entries(s.topTriggeredRules ?? {})) a.rules[r] = (a.rules[r] ?? 0) + c;
        a.seconds += n(s.scrapeSeconds) + n(s.pipelineSeconds);
        if (s.scraperError || s.pipelineError || s.detectorFailed || s.emptyResult) a.failedSources++;
    }
    a.flagged = a.pending + a.blocked;
    return a;
}

export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

export function fmtDuration(sec: number | null | undefined): string {
    if (sec == null) return "—";
    if (sec < 60) return `${Math.round(sec)}s`;
    const m = Math.floor(sec / 60);
    return m < 60 ? `${m}m ${Math.round(sec % 60)}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export const runId = (r: Pick<ScrapeRun, "_id" | "jobId">) => r.jobId ?? r._id;

export function sourceHealth(s: ScrapeSource): "ok" | "warn" | "fail" {
    if (s.scraperError || s.pipelineError) return "fail";
    if (s.emptyResult || s.detectorFailed) return "warn";
    return "ok";
}
