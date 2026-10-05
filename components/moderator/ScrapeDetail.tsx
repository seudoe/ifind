"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ScrapeRun, ScrapeSource } from "@/types/scrape";
import { aggregate, fmtDuration, HIST_KEYS, pct, sourceHealth } from "@/lib/scrapeStats";
import { Card, COLORS, GroupedBars, HBars, Stat, StackBar } from "./charts";
import { healthColor, statusColor } from "./ScrapesPanel";

export function ScrapeDetail() {
    const { username, jobId } = useParams<{ username: string; jobId: string }>();
    const [run, setRun] = useState<ScrapeRun | null>(null);
    const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

    useEffect(() => {
        fetch(`/api/moderator/scrapes/${jobId}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((j) => { setRun(j.data); setState("ok"); })
            .catch(() => setState("missing"));
    }, [jobId]);

    const agg = useMemo(() => (run ? aggregate(run.sources) : null), [run]);

    if (state === "loading") return <Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" />;
    if (state === "missing" || !run || !agg) return <p className="text-sm text-[var(--text-3)]">Scrape run not found.</p>;

    const ids = run.sources.map((s) => s.id);
    const rules = Object.entries(agg.rules).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));

    return (
        <div className="space-y-6">
            <Link href={`/moderator/${username}/scrapes`} className="inline-flex items-center gap-1 text-sm text-[var(--text-2)] hover:text-[var(--primary)]">
                <ArrowLeft className="h-4 w-4" /> All scrapes
            </Link>

            <Card>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: statusColor(run.status) }} />
                        <span className="text-lg font-semibold capitalize">{run.status}</span>
                    </div>
                    <Meta label="Started" value={new Date(run.startedAt).toLocaleString()} />
                    <Meta label="Finished" value={run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"} />
                    <Meta label="Duration" value={fmtDuration(run.durationSeconds)} />
                    <Meta label="Trigger" value={run.trigger} />
                    <Meta label="Vectorizer" value={run.vectorizerConfigured ? "configured" : "not configured"} />
                    <Meta label="Job" value={run.jobId ?? run._id} mono />
                </div>
                {run.error && <p className="mt-3 text-sm text-red-600">{run.error}</p>}
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat label="Scraped" value={agg.scraped} />
                <Stat label="Saved to staging" value={agg.saved} sub={`${pct(agg.saved, agg.scraped)}% of scraped`} color={COLORS.green} />
                <Stat label="Duplicates" value={agg.duplicate} sub={`${pct(agg.duplicate, agg.scraped)}%`} />
                <Stat label="Invalid" value={agg.rejected} />
                <Stat label="Flagged" value={agg.flagged} sub={`${pct(agg.flagged, agg.saved)}% of saved`} color={COLORS.amber} />
                <Stat label="Auto-blocked" value={agg.blocked} sub={`${pct(agg.blocked, agg.saved)}% of saved`} color={COLORS.red} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <Card title="Scam score distribution (all sources, % of saved)">
                    <GroupedBars
                        unit="%"
                        labels={HIST_KEYS}
                        series={[{ name: "All sources", color: COLORS.blue, values: agg.hist.map((v) => pct(v, agg.saved)) }]}
                    />
                </Card>
                <Card title="Per source: what happened to scraped listings">
                    <GroupedBars
                        labels={ids}
                        series={[
                            { name: "Scraped", color: COLORS.gray, values: run.sources.map((s) => s.scraped) },
                            { name: "Saved", color: COLORS.green, values: run.sources.map((s) => s.saved) },
                            { name: "Duplicate", color: COLORS.blue, values: run.sources.map((s) => s.duplicate) },
                            { name: "Invalid", color: COLORS.purple, values: run.sources.map((s) => s.rejected) },
                        ]}
                    />
                </Card>
                <Card title="Per source: time spent (seconds)">
                    <GroupedBars
                        labels={ids}
                        series={[
                            { name: "Scraping", color: COLORS.blue, values: run.sources.map((s) => s.scrapeSeconds) },
                            { name: "Scam check + save", color: COLORS.amber, values: run.sources.map((s) => s.pipelineSeconds) },
                        ]}
                    />
                </Card>
                <Card title="Per source: moderation outcome">
                    <div className="space-y-3">
                        {run.sources.map((s) => (
                            <div key={s.id}>
                                <div className="text-xs text-[var(--text-2)] mb-1">{s.id}</div>
                                <StackBar
                                    thin
                                    parts={[
                                        { label: "approved", value: s.statusCounts?.auto_approved ?? 0, color: COLORS.green },
                                        { label: "pending", value: s.statusCounts?.pending_review ?? 0, color: COLORS.amber },
                                        { label: "rejected", value: s.statusCounts?.auto_rejected ?? 0, color: COLORS.red },
                                    ]}
                                />
                            </div>
                        ))}
                    </div>
                </Card>
                <Card title="Top triggered rules" className="lg:col-span-2">
                    <HBars rows={rules} color={COLORS.amber} />
                </Card>
            </div>

            <section>
                <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Sources</h2>
                <div className="flex flex-col gap-3">
                    {run.sources.map((s) => <SourceCard key={s.id} s={s} />)}
                </div>
            </section>
        </div>
    );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <div className="text-[11px] text-[var(--text-3)]">{label}</div>
            <div className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
        </div>
    );
}

function SourceCard({ s }: { s: ScrapeSource }) {
    const h = sourceHealth(s);
    const hist = HIST_KEYS.map((k) => s.scoreHistogram?.[k] ?? 0);
    const rules = Object.entries(s.topTriggeredRules ?? {}).slice(0, 6).map(([label, value]) => ({ label, value }));
    const fact = (label: string, v: number | string | undefined | null) => (
        <div key={label} className="min-w-[88px]">
            <div className="text-sm font-semibold tabular-nums">{v ?? "—"}</div>
            <div className="text-[11px] text-[var(--text-3)]">{label}</div>
        </div>
    );
    return (
        <Card>
            <div className="flex items-center gap-2 mb-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: healthColor(h) }} />
                <span className="font-semibold">{s.label}</span>
                <span className="text-xs text-[var(--text-3)]">({s.id}) · cap {s.maxRequested ?? "—"}</span>
            </div>
            {(s.scraperError || s.pipelineError || s.detectorFailed || s.emptyResult) && (
                <ul className="mb-3 text-xs text-red-600 space-y-0.5">
                    {s.scraperError && <li>Scraper error: {s.scraperError}</li>}
                    {s.pipelineError && <li>Pipeline error: {s.pipelineError}</li>}
                    {s.detectorFailed && <li>Scam detector failed, all routed to manual review{s.detectorError ? `: ${s.detectorError}` : ""}</li>}
                    {s.emptyResult && !s.scraperError && <li>Returned no listings</li>}
                </ul>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
                {fact("scraped", s.scraped)}
                {fact("saved", s.saved)}
                {fact("duplicates", s.duplicate)}
                {fact("invalid", s.rejected)}
                {fact("missing fields", s.rejectedMissingFields)}
                {fact("bad URL", s.rejectedBadUrl)}
                {fact("errors", s.errors)}
                {fact("scrape time", fmtDuration(s.scrapeSeconds))}
                {fact("pipeline time", fmtDuration(s.pipelineSeconds))}
                {fact("detector time", fmtDuration(s.detectorSeconds))}
                {fact("companies", s.uniqueCompanies)}
                {fact("low confidence", s.lowConfidence)}
                {fact("hard-disqualified", s.hardDisqualified)}
                {fact("paid / unpaid", s.stipend ? `${s.stipend.paid} / ${s.stipend.unpaid}` : undefined)}
                {fact("remote", s.remote)}
                {fact("no skills", s.noSkills)}
                {fact("no deadline", s.noDeadline)}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <GroupedBars unit="" height={90} labels={HIST_KEYS} series={[{ name: "Listings per score bucket", color: COLORS.blue, values: hist }]} />
                <HBars rows={rules} color={COLORS.amber} />
            </div>
        </Card>
    );
}
