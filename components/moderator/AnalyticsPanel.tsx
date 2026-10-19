"use client";

// CLIENT component: analytics modules are imported as TYPES ONLY (erased at build), so no server SDK or
// secret can reach the browser bundle. The preset list is defined locally for the same reason.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RangeKey } from "@/lib/analytics/config";
import type { AnalyticsResult } from "@/lib/analytics/service";
import type { OverviewReport } from "@/lib/analytics/reports";
import { Card, COLORS, GroupedBars, HBars, Stat } from "./charts";

const PRESETS: { key: RangeKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
];

const REALTIME_POLL_MS = 60_000;

async function fetchAnalytics(view: "overview" | "realtime", range?: RangeKey): Promise<AnalyticsResult> {
    const qs = new URLSearchParams({ view });
    if (range) qs.set("range", range);
    const res = await fetch(`/api/moderator/analytics?${qs}`, { credentials: "include" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error("Failed to load analytics");
    return json.data as AnalyticsResult;
}

/** A new or quiet property reports zeros across the board. */
function isAllZero(k: OverviewReport["kpis"]): boolean {
    return k.activeUsers === 0 && k.sessions === 0 && k.pageviews === 0;
}

function staleNote(fetchedAt: string): string {
    const d = new Date(fetchedAt);
    const when = Number.isNaN(d.getTime()) ? fetchedAt : d.toLocaleString();
    return `Data may be stale (last updated ${when})`;
}

/** The overview result for one range; `range` identifies which request it belongs to. */
type Loaded = { range: RangeKey; nonce: number } & ({ ok: true; result: AnalyticsResult } | { ok: false });

export function AnalyticsPanel() {
    const [range, setRange] = useState<RangeKey>("7d");
    const [nonce, setNonce] = useState(0); // bumped by "Retry" to re-run the fetch
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [live, setLive] = useState<AnalyticsResult | null>(null);

    // Overview: re-fetch when the range (or the retry nonce) changes. Loading is derived (below) rather than
    // set synchronously here.
    useEffect(() => {
        let cancelled = false;
        fetchAnalytics("overview", range)
            .then((result) => {
                if (!cancelled) setLoaded({ range, nonce, ok: true, result });
            })
            .catch(() => {
                if (cancelled) return;
                toast.error("Failed to load analytics");
                setLoaded({ range, nonce, ok: false });
            });
        return () => {
            cancelled = true;
        };
    }, [range, nonce]);

    // Realtime "Active now": poll every 60 s, only while the document is visible; failures stay silent.
    useEffect(() => {
        let cancelled = false;
        const poll = () => {
            if (document.hidden) return;
            fetchAnalytics("realtime")
                .then((r) => {
                    if (!cancelled) setLive(r);
                })
                .catch(() => {});
        };
        poll();
        const id = window.setInterval(poll, REALTIME_POLL_MS);
        document.addEventListener("visibilitychange", poll);
        return () => {
            cancelled = true;
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", poll);
        };
    }, []);

    const loading = !loaded || loaded.range !== range || loaded.nonce !== nonce;
    const activeNow =
        live && live.configured && "activeUsers" in live.report ? live.report.activeUsers : null;

    const rangeButtons = (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
            {PRESETS.map((p) => (
                <Button
                    key={p.key}
                    size="sm"
                    variant={range === p.key ? "primary" : "secondary"}
                    aria-pressed={range === p.key}
                    onClick={() => setRange(p.key)}
                >
                    {p.label}
                </Button>
            ))}
        </div>
    );

    let body: React.ReactNode;
    if (loading) {
        body = (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
            </div>
        );
    } else if (!loaded.ok) {
        body = (
            <Card title="Analytics unavailable">
                <p className="text-sm text-[var(--text-2)]">Could not load analytics. Check your connection and try again.</p>
                <div className="mt-3">
                    <Button size="sm" variant="secondary" onClick={() => setNonce((n) => n + 1)}>
                        Retry
                    </Button>
                </div>
            </Card>
        );
    } else if (!loaded.result.configured) {
        body = (
            <Card title="Analytics not configured">
                <p className="text-sm text-[var(--text-2)] mb-2">These environment variables are missing or invalid:</p>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                    {loaded.result.missing.map((name) => (
                        <li key={name}>
                            <code>{name}</code>
                        </li>
                    ))}
                </ul>
            </Card>
        );
    } else if (!("kpis" in loaded.result.report)) {
        // The overview view always returns a full report; treat anything else as a failed load.
        body = (
            <Card title="Analytics unavailable">
                <p className="text-sm text-[var(--text-2)]">Unexpected response from the analytics service.</p>
            </Card>
        );
    } else {
        const { stale, fetchedAt } = loaded.result;
        const r = loaded.result.report;
        const { kpis, funnel } = r;
        body = (
            <div className="space-y-5">
                {stale && (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">{staleNote(fetchedAt)}</p>
                )}
                {isAllZero(kpis) && (
                    <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-2)]">
                        GA data can take 24-48h to appear
                    </p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Stat
                        label="Active now"
                        value={activeNow ?? "-"}
                        sub="last 30 min"
                        color={activeNow ? COLORS.green : undefined}
                    />
                    <Stat label="Active users" value={kpis.activeUsers} />
                    <Stat label="Sessions" value={kpis.sessions} />
                    <Stat label="New users" value={kpis.newUsers} />
                    <Stat label="Pageviews" value={kpis.pageviews} />
                </div>

                <Card title="Funnel (users)">
                    <HBars rows={funnel.steps.map((s) => ({ label: s.label, value: s.users }))} />
                    <p className="text-xs text-[var(--text-3)] mt-3">
                        Applied = users with either event. Apply click: <b>{funnel.applyClickUsers}</b> users, application submitted:{" "}
                        <b>{funnel.applicationSubmittedUsers}</b> users.
                    </p>
                </Card>

                <div className="grid md:grid-cols-2 gap-5">
                    <Card title="Traffic sources (users)">
                        <HBars rows={r.sources.map((s) => ({ label: s.channel, value: s.users }))} color={COLORS.purple} />
                    </Card>
                    <Card title="Top pages (views)">
                        <HBars rows={r.topPages.map((p) => ({ label: p.path, value: p.views }))} />
                    </Card>
                </div>

                <Card title="Users over time">
                    <GroupedBars
                        labels={r.daily.map((d) => d.date.slice(5))}
                        series={[{ name: "Users", color: COLORS.blue, values: r.daily.map((d) => d.users) }]}
                    />
                </Card>

                <div className="grid md:grid-cols-2 gap-5">
                    <Card title="Devices (users)">
                        <HBars rows={r.devices.map((d) => ({ label: d.device, value: d.users }))} color={COLORS.amber} />
                    </Card>
                    <Card title="Countries (users)">
                        <HBars rows={r.countries.map((c) => ({ label: c.country, value: c.users }))} color={COLORS.green} />
                    </Card>
                </div>

                {r.topInternships === null ? (
                    <p className="text-xs text-[var(--text-3)]">
                        Top internships are hidden until the <code>internship_id</code> custom dimension is registered in Google Analytics
                        (event-scoped, event parameter <code>internship_id</code>).
                    </p>
                ) : (
                    <Card title="Top internships (views)">
                        <HBars rows={r.topInternships.map((t) => ({ label: t.internshipId, value: t.views }))} color={COLORS.slate} />
                    </Card>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {rangeButtons}
            {body}
        </div>
    );
}
