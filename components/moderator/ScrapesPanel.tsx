"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import type { ScrapeRun, ScrapeSource } from "@/types/scrape";
import { aggregate, fmtDuration, HIST_KEYS, pct, runId, sourceHealth } from "@/lib/scrapeStats";
import { Card, COLORS, GroupedBars, HBars, Stat, StackBar } from "./charts";

const DAY_OPTIONS = [7, 30, 90];

export const statusColor = (s: ScrapeRun["status"]) =>
    s === "done" ? COLORS.green : s === "failed" ? COLORS.red : COLORS.blue;

export const healthColor = (h: "ok" | "warn" | "fail") =>
    h === "ok" ? COLORS.green : h === "warn" ? COLORS.amber : COLORS.red;

export function ScrapesPanel() {
    const { username } = useParams<{ username: string }>();
    const [runs, setRuns] = useState<ScrapeRun[]>([]);
    const [days, setDays] = useState(30);
    const [source, setSource] = useState("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/moderator/scrapes?days=${days}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((j) => setRuns(j.data ?? []))
            .catch(() => toast.error("Failed to load scrape runs"))
            .finally(() => setLoading(false));
    }, [days]);

    const sourceIds = useMemo(
        () => [...new Set(runs.flatMap((r) => r.sources.map((s) => s.id)))].sort(),
        [runs],
    );

    // Runs narrowed to the selected source (each run keeps only that source's entry).
    const view = useMemo(
        () => runs
            .map((r) => ({ run: r, sources: source === "all" ? r.sources : r.sources.filter((s) => s.id === source) }))
            .filter((v) => v.sources.length),
        [runs, source],
    );

    const all = useMemo(() => aggregate(runs.flatMap((r) => r.sources)), [runs]);
    const sel = useMemo(() => aggregate(view.flatMap((v) => v.sources)), [view]);

    const daily = useMemo(() => {
        const m = new Map<string, { scraped: number; saved: number; flagged: number }>();
        for (const v of [...view].reverse()) {
            const d = v.run.startedAt.slice(5, 10);
            const a = aggregate(v.sources);
            const cur = m.get(d) ?? { scraped: 0, saved: 0, flagged: 0 };
            cur.scraped += a.scraped; cur.saved += a.saved; cur.flagged += a.flagged;
            m.set(d, cur);
        }
        return [...m.entries()];
    }, [view]);

    // Scoreboard is always across every source so they can be compared with each other.
    const board = useMemo(
        () => sourceIds.map((id) => {
            const rows = runs.flatMap((r) => r.sources.filter((s) => s.id === id));
            const a = aggregate(rows);
            return {
                id,
                flagRate: pct(a.flagged, a.saved),
                dupeRate: pct(a.duplicate, a.scraped),
                failRate: pct(a.failedSources, rows.length),
            };
        }),
        [runs, sourceIds],
    );

    const histAll = HIST_KEYS.map((_, i) => pct(all.hist[i], all.saved));
    const histSel = HIST_KEYS.map((_, i) => pct(sel.hist[i], sel.saved));
    const rules = Object.entries(sel.rules).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
                    {DAY_OPTIONS.map((d) => (
                        <button
                            key={d}
                            onClick={() => { setLoading(true); setDays(d); }}
                            className={`px-3 py-1.5 ${days === d ? "bg-[var(--primary-bg)] text-[var(--primary)] font-medium" : "text-[var(--text-2)]"}`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
                <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                >
                    <option value="all">All sources</option>
                    {sourceIds.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-3)]" />}
            </div>

            {/* Overview */}
            <section className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Runs" value={view.length} sub={`last ${days} days`} />
                    <Stat label="Scraped" value={sel.scraped} />
                    <Stat label="Saved to staging" value={sel.saved} sub={`${pct(sel.saved, sel.scraped)}% of scraped`} color={COLORS.green} />
                    <Stat label="Duplicates" value={sel.duplicate} sub={`${pct(sel.duplicate, sel.scraped)}% of scraped`} />
                    <Stat label="Flagged (review + block)" value={sel.flagged} sub={`${pct(sel.flagged, sel.saved)}% of saved`} color={COLORS.amber} />
                    <Stat label="Auto-blocked" value={sel.blocked} sub={`${pct(sel.blocked, sel.saved)}% of saved`} color={COLORS.red} />
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <Card title={source === "all" ? "Scam score distribution (% of saved)" : `Scam score: ${source} vs all (% of saved)`}>
                        <GroupedBars
                            unit="%"
                            labels={HIST_KEYS}
                            series={source === "all"
                                ? [{ name: "All sources", color: COLORS.blue, values: histAll }]
                                : [
                                    { name: "All sources", color: COLORS.gray, values: histAll },
                                    { name: source, color: COLORS.blue, values: histSel },
                                ]}
                        />
                    </Card>
                    <Card title="Outcome of scraped listings">
                        <StackBar
                            parts={[
                                { label: "Auto-approved", value: sel.approved, color: COLORS.green },
                                { label: "Pending review", value: sel.pending, color: COLORS.amber },
                                { label: "Auto-rejected", value: sel.blocked, color: COLORS.red },
                                { label: "Duplicates", value: sel.duplicate, color: COLORS.gray },
                                { label: "Invalid", value: sel.rejected, color: COLORS.purple },
                                { label: "Errors", value: sel.errors, color: COLORS.slate },
                            ]}
                        />
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] mt-5 mb-3">Top triggered rules</h3>
                        <HBars rows={rules} color={COLORS.amber} />
                    </Card>
                    <Card title="Per day">
                        <GroupedBars
                            labels={daily.map(([d]) => d)}
                            series={[
                                { name: "Scraped", color: COLORS.gray, values: daily.map(([, a]) => a.scraped) },
                                { name: "Saved", color: COLORS.green, values: daily.map(([, a]) => a.saved) },
                                { name: "Flagged", color: COLORS.red, values: daily.map(([, a]) => a.flagged) },
                            ]}
                        />
                    </Card>
                    <Card title="Source comparison">
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-[var(--text-3)] mb-1.5">Flag rate (share of saved needing review or blocked)</div>
                                <HBars unit="%" max={100} color={COLORS.red} rows={board.map((b) => ({ label: b.id, value: b.flagRate }))} />
                            </div>
                            <div>
                                <div className="text-xs text-[var(--text-3)] mb-1.5">Failed or empty runs (hard to scrape)</div>
                                <HBars unit="%" max={100} color={COLORS.purple} rows={board.map((b) => ({ label: b.id, value: b.failRate }))} />
                            </div>
                            <div>
                                <div className="text-xs text-[var(--text-3)] mb-1.5">Duplicate rate</div>
                                <HBars unit="%" max={100} color={COLORS.gray} rows={board.map((b) => ({ label: b.id, value: b.dupeRate }))} />
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            {/* Run list */}
            <section>
                <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Scrape runs</h2>
                <div className="flex flex-col gap-3">
                    {!loading && view.length === 0 && <p className="text-sm text-[var(--text-3)]">No runs in this period.</p>}
                    {view.map(({ run, sources }) => (
                        <RunCard key={run._id} run={run} sources={sources} href={`/moderator/${username}/scrapes/${runId(run)}`} />
                    ))}
                </div>
            </section>
        </div>
    );
}

function Num({ label, value, color }: { label: string; value: number | string; color?: string }) {
    return (
        <div className="min-w-[56px]">
            <div className="text-lg font-semibold leading-tight tabular-nums" style={{ color }}>{value}</div>
            <div className="text-[11px] text-[var(--text-3)]">{label}</div>
        </div>
    );
}

function RunCard({ run, sources, href }: { run: ScrapeRun; sources: ScrapeSource[]; href: string }) {
    const a = aggregate(sources);
    return (
        <Link
            href={href}
            className="flex items-center gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--primary)] transition-colors"
        >
            <div className="w-44 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor(run.status) }} />
                    <span className="text-sm font-semibold capitalize">{run.status}</span>
                    {run.trigger === "checkpoint" && (
                        <span className="text-[10px] rounded bg-[var(--surface-3)] px-1.5 py-0.5">checkpoint</span>
                    )}
                </div>
                <div className="text-xs text-[var(--text-2)] mt-1">{new Date(run.startedAt).toLocaleString()}</div>
                <div className="text-xs text-[var(--text-3)]">took {fmtDuration(run.durationSeconds)}</div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                    {sources.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 text-[11px] rounded-full border border-[var(--border)] px-2 py-0.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: healthColor(sourceHealth(s)) }} />
                            {s.id}
                        </span>
                    ))}
                </div>
                <StackBar
                    thin
                    parts={[
                        { label: "approved", value: a.approved, color: COLORS.green },
                        { label: "pending", value: a.pending, color: COLORS.amber },
                        { label: "rejected", value: a.blocked, color: COLORS.red },
                    ]}
                />
                {run.error && (
                    <p className="text-xs text-red-600 flex items-center gap-1 truncate">
                        <AlertTriangle className="h-3 w-3 shrink-0" />{run.error}
                    </p>
                )}
            </div>

            <div className="hidden md:flex gap-4 shrink-0">
                <Num label="scraped" value={a.scraped} />
                <Num label="saved" value={a.saved} color={COLORS.green} />
                <Num label="dupes" value={a.duplicate} />
                <Num label="flagged" value={a.flagged} color={COLORS.amber} />
                <Num label="failed src" value={a.failedSources} color={a.failedSources ? COLORS.red : undefined} />
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--text-3)] shrink-0" />
        </Link>
    );
}
