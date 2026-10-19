"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, COLORS, GroupedBars, Stat } from "./charts";

interface UsageOverview {
    settings: {
        defaultDailyCredits: number;
        systemDailyBudgetUsd: number;
        featureCredits: Record<string, number>;
        defaultFeatureCredits: Record<string, number>;
    };
    systemToday: {
        costUsd: number;
        budgetUsd: number;
        budgetExceeded: boolean;
        bySource: Array<{ source: string; costUsd: number; llmCalls: number; tokensIn: number; tokensOut: number }>;
    };
    perDay: Array<{ day: string; usersCostUsd: number; systemCostUsd: number; requests: number; blocked: number; activeUsers: number }>;
    topUsers: Array<{ userId: string; name: string; username: string; costUsd: number; creditsUsed: number; requests: number; blocked: number; daysHitLimit: number }>;
}

async function fetchOverview(): Promise<UsageOverview> {
    const res = await fetch("/api/moderator/usage", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load usage");
    return (await res.json()).data;
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export function UsagePanel() {
    const [data, setData] = useState<UsageOverview | null>(null);
    const [loading, setLoading] = useState(true); // true until the first load finishes
    const [saving, setSaving] = useState(false);
    const [defaultCredits, setDefaultCredits] = useState("");
    const [budget, setBudget] = useState("");
    const [featureCredits, setFeatureCredits] = useState<Record<string, string>>({});

    const apply = useCallback((d: UsageOverview) => {
        setData(d);
        setDefaultCredits(String(d.settings.defaultDailyCredits));
        setBudget(String(d.settings.systemDailyBudgetUsd));
        setFeatureCredits(Object.fromEntries(Object.entries(d.settings.featureCredits).map(([k, v]) => [k, String(v)])));
    }, []);

    const reload = useCallback(
        () =>
            fetchOverview()
                .then(apply)
                .catch(() => toast.error("Failed to load usage"))
                .finally(() => setLoading(false)),
        [apply],
    );

    useEffect(() => {
        fetchOverview()
            .then(apply)
            .catch(() => toast.error("Failed to load usage"))
            .finally(() => setLoading(false));
    }, [apply]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/moderator/usage", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    defaultDailyCredits: Number(defaultCredits),
                    systemDailyBudgetUsd: Number(budget),
                    featureCredits: Object.fromEntries(Object.entries(featureCredits).map(([k, v]) => [k, Number(v)])),
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error ?? "Save failed");
            toast.success("Limits saved");
            reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
            </div>
        );
    }
    if (!data) return null;

    const { systemToday, perDay, topUsers } = data;
    const days = [...perDay].reverse();
    const budgetPct = systemToday.budgetUsd > 0 ? Math.round((systemToday.costUsd / systemToday.budgetUsd) * 100) : 0;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat
                    label="Scrapers + bot today"
                    value={usd(systemToday.costUsd)}
                    sub={`${budgetPct}% of ${usd(systemToday.budgetUsd)} budget`}
                    color={systemToday.budgetExceeded ? COLORS.red : budgetPct >= 80 ? COLORS.amber : COLORS.green}
                />
                <Stat label="Students today" value={usd(perDay[0]?.usersCostUsd ?? 0)} sub={`${perDay[0]?.activeUsers ?? 0} active`} />
                <Stat label="Requests today" value={perDay[0]?.requests ?? 0} />
                <Stat label="Blocked today" value={perDay[0]?.blocked ?? 0} sub="hit the daily limit" color={(perDay[0]?.blocked ?? 0) > 0 ? COLORS.amber : undefined} />
            </div>

            {systemToday.budgetExceeded && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
                    The daily budget for scrapers and the Telegram bot was reached, so their AI calls are paused until midnight IST.
                </p>
            )}

            <Card title="Estimated cost, last 14 days (USD)">
                <GroupedBars
                    labels={days.map((d) => d.day.slice(5))}
                    series={[
                        { name: "Students", color: COLORS.blue, values: days.map((d) => Number(d.usersCostUsd.toFixed(4))) },
                        { name: "Scrapers + bot", color: COLORS.purple, values: days.map((d) => Number(d.systemCostUsd.toFixed(4))) },
                    ]}
                />
            </Card>

            <div className="grid md:grid-cols-2 gap-5">
                <Card title="Scrapers + bot today, by source">
                    {systemToday.bySource.length === 0 ? (
                        <p className="text-sm text-[var(--text-3)]">No AI calls yet today</p>
                    ) : (
                        <table className="w-full text-sm">
                            <tbody>
                                {systemToday.bySource.map((s) => (
                                    <tr key={s.source} className="border-b border-[var(--border)] last:border-0">
                                        <td className="py-1.5">{s.source}</td>
                                        <td className="py-1.5 text-right tabular-nums">{s.llmCalls} calls</td>
                                        <td className="py-1.5 text-right tabular-nums">{usd(s.costUsd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                <Card title="Top students by cost, last 7 days">
                    {topUsers.length === 0 ? (
                        <p className="text-sm text-[var(--text-3)]">No student usage yet</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-[var(--text-3)] text-left">
                                    <th className="pb-1 font-medium">Student</th>
                                    <th className="pb-1 font-medium text-right">Cost</th>
                                    <th className="pb-1 font-medium text-right">Requests</th>
                                    <th className="pb-1 font-medium text-right">Limit hit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topUsers.map((u) => (
                                    <tr key={u.userId} className="border-t border-[var(--border)]">
                                        <td className="py-1.5">
                                            {u.name} <span className="text-xs text-[var(--text-3)]">@{u.username}</span>
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">{usd(u.costUsd)}</td>
                                        <td className="py-1.5 text-right tabular-nums">{u.requests}</td>
                                        <td className="py-1.5 text-right tabular-nums">{u.daysHitLimit}d</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>

            <Card title="Limits">
                <div className="grid sm:grid-cols-2 gap-4">
                    <label className="text-sm">
                        <span className="block text-xs text-[var(--text-3)] mb-1">Daily credits per student (default)</span>
                        <input
                            type="number"
                            min={0}
                            value={defaultCredits}
                            onChange={(e) => setDefaultCredits(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]"
                        />
                    </label>
                    <label className="text-sm">
                        <span className="block text-xs text-[var(--text-3)] mb-1">Daily budget for scrapers + bot (USD)</span>
                        <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]"
                        />
                    </label>
                </div>
                <p className="text-xs text-[var(--text-3)] mt-4 mb-2">Credits each request costs, by feature</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Object.entries(featureCredits).map(([feature, value]) => (
                        <label key={feature} className="text-xs text-[var(--text-2)]">
                            <span className="block mb-1">{feature}</span>
                            <input
                                type="number"
                                min={0}
                                value={value}
                                onChange={(e) => setFeatureCredits((prev) => ({ ...prev, [feature]: e.target.value }))}
                                className="w-full px-2 py-1.5 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]"
                            />
                        </label>
                    ))}
                </div>
                <div className="mt-4">
                    <Button size="sm" loading={saving} onClick={save}>
                        Save limits
                    </Button>
                </div>
            </Card>
        </div>
    );
}
