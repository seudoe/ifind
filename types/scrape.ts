// Mirrors documents written by internScraper to `ifind.scrape.runs`.
export interface ScrapeSource {
    id: string;
    label: string;
    maxRequested: number | null;
    startedAt: string;
    scrapeSeconds: number;
    pipelineSeconds: number;
    detectorSeconds: number | null;
    scraped: number;
    saved: number;
    duplicate: number;
    rejected: number;
    errors: number;
    rejectedMissingFields?: number;
    rejectedBadUrl?: number;
    scraperError: string | null;
    pipelineError: string | null;
    detectorFailed?: boolean;
    detectorError?: string | null;
    emptyResult: boolean;
    statusCounts?: { auto_approved: number; pending_review: number; auto_rejected: number };
    decisionCounts?: { clear: number; review: number; block: number };
    scoreHistogram?: Record<string, number>;
    lowConfidence?: number;
    hardDisqualified?: number;
    topTriggeredRules?: Record<string, number>;
    uniqueCompanies?: number;
    stipend?: { paid: number; unpaid: number; performanceBased: number };
    remote?: number;
    noSkills?: number;
    noDeadline?: number;
}

export interface ScrapeRun {
    _id: string;
    jobId: string | null;
    trigger: "scrape" | "checkpoint";
    status: "running" | "done" | "failed";
    startedAt: string;
    finishedAt: string | null;
    durationSeconds: number | null;
    requested: Record<string, number>;
    vectorizerConfigured?: boolean;
    totals: Partial<Record<"saved" | "duplicate" | "rejected" | "errors" | "scraped", number>>;
    error?: string | null;
    sources: ScrapeSource[];
}
