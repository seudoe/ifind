"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { COLORS, HBars } from "./charts";
import type { UserSummary } from "@/types/moderator";

interface Totals {
    creditsUsed: number;
    requests: number;
    blocked: number;
    refunds: number;
    llmCalls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
}

interface SignalsResponse {
    forId: string;
    user: { name: string; username: string; email: string; isBanned?: boolean; bannedReason?: string | null };
    signals: {
        account: { createdAt: string; lastLoginAt: string | null; loginCount: number; failedLogins24h: number; applications: number; maxApplicationsPerHour: number };
        credits: { limit: number; isOverride: boolean; usedToday: number; remainingToday: number };
        usage: { today: Totals; last7: Totals; last30: Totals };
        byFeature30: Record<string, number>;
        history: Array<{ day: string; creditsUsed: number; requests: number; blocked: number; costUsd: number; hitLimit: boolean }>;
        behaviour: { maxRequestsPerMinute: number; maxRepeatedRequests: number; limitHitDays7: number; topCostStreak: number };
        flags: Array<{ code: string; label: string; detail: string }>;
        recentRequests: Array<{ ts: string; feature: string; status: string; credits: number; costUsd: number }>;
    };
    banHistory: Array<{ _id: string; action: "ban" | "unban"; reason: string | null; moderatorName?: string | null; at: string }>;
}

async function fetchSignals(id: string): Promise<SignalsResponse> {
    const res = await fetch(`/api/moderator/users/${id}/signals`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load");
    return (await res.json()).data;
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "never");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">{title}</h4>
            {children}
        </section>
    );
}

export function UserDetailModal({ user, onClose, onChanged }: { user: UserSummary | null; onClose: () => void; onChanged: () => void }) {
    const [loaded, setLoaded] = useState<SignalsResponse | null>(null);
    const [limitInput, setLimitInput] = useState("");
    const [saving, setSaving] = useState(false);

    const apply = useCallback((id: string, d: SignalsResponse) => {
        setLoaded({ ...d, forId: id });
        setLimitInput(d.signals.credits.isOverride ? String(d.signals.credits.limit) : "");
    }, []);

    const reload = useCallback(
        (id: string) =>
            fetchSignals(id)
                .then((d) => apply(id, d))
                .catch(() => toast.error("Failed to load user details")),
        [apply],
    );

    useEffect(() => {
        if (!user) return;
        reload(user._id);
    }, [user, reload]);

    // Only show numbers that belong to the user currently open (the previous user's stay hidden until the new ones arrive).
    const data = user && loaded?.forId === user._id ? loaded : null;
    const loading = !!user && !data;

    const saveLimit = async (limit: number | null) => {
        if (!user) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/moderator/users/${user._id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "set-limit", limit }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error ?? "Could not save");
            toast.success(limit === null ? "Back to the default limit" : "Daily limit updated");
            await reload(user._id);
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
        } finally {
            setSaving(false);
        }
    };

    const s = data?.signals;

    return (
        <Modal open={!!user} onClose={onClose} size="xl" title={user ? `${user.name} (@${user.username})` : undefined} description={user?.email}>
            {loading && !data && (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
                </div>
            )}
            {data && s && (
                <div>
                    <Section title="Flags">
                        {s.flags.length === 0 ? (
                            <p className="text-sm text-[var(--text-3)]">Nothing unusual.</p>
                        ) : (
                            <ul className="space-y-1">
                                {s.flags.map((f) => (
                                    <li key={f.code} className="text-sm">
                                        <Badge variant="warning">{f.label}</Badge> <span className="text-[var(--text-2)]">{f.detail}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>

                    <Section title="Daily credits">
                        <p className="text-sm text-[var(--text-2)] mb-2">
                            {s.credits.usedToday} of {s.credits.limit} used today ({s.credits.remainingToday} left){" "}
                            {s.credits.isOverride && <Badge variant="outline">custom limit</Badge>}
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                value={limitInput}
                                onChange={(e) => setLimitInput(e.target.value)}
                                placeholder="Site default"
                                className="w-32 px-2 py-1.5 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]"
                            />
                            <Button size="sm" loading={saving} disabled={limitInput.trim() === ""} onClick={() => saveLimit(Number(limitInput))}>
                                Set limit
                            </Button>
                            {s.credits.isOverride && (
                                <Button size="sm" variant="secondary" loading={saving} onClick={() => saveLimit(null)}>
                                    Use default
                                </Button>
                            )}
                        </div>
                    </Section>

                    <Section title="Account">
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                            <div><dt className="text-xs text-[var(--text-3)]">Joined</dt><dd>{when(s.account.createdAt)}</dd></div>
                            <div><dt className="text-xs text-[var(--text-3)]">Last login</dt><dd>{when(s.account.lastLoginAt)}</dd></div>
                            <div><dt className="text-xs text-[var(--text-3)]">Logins</dt><dd>{s.account.loginCount}</dd></div>
                            <div><dt className="text-xs text-[var(--text-3)]">Failed logins (24h)</dt><dd>{s.account.failedLogins24h}</dd></div>
                            <div><dt className="text-xs text-[var(--text-3)]">Applications</dt><dd>{s.account.applications} (peak {s.account.maxApplicationsPerHour}/hour)</dd></div>
                        </dl>
                    </Section>

                    <Section title="Usage">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-[var(--text-3)] text-left">
                                    <th className="pb-1 font-medium"></th>
                                    <th className="pb-1 font-medium text-right">Requests</th>
                                    <th className="pb-1 font-medium text-right">Blocked</th>
                                    <th className="pb-1 font-medium text-right">LLM calls</th>
                                    <th className="pb-1 font-medium text-right">Tokens</th>
                                    <th className="pb-1 font-medium text-right">Est. cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(["today", "last7", "last30"] as const).map((k) => (
                                    <tr key={k} className="border-t border-[var(--border)]">
                                        <td className="py-1.5">{k === "today" ? "Today" : k === "last7" ? "7 days" : "30 days"}</td>
                                        <td className="py-1.5 text-right tabular-nums">{s.usage[k].requests}</td>
                                        <td className="py-1.5 text-right tabular-nums">{s.usage[k].blocked}</td>
                                        <td className="py-1.5 text-right tabular-nums">{s.usage[k].llmCalls}</td>
                                        <td className="py-1.5 text-right tabular-nums">{(s.usage[k].tokensIn + s.usage[k].tokensOut).toLocaleString()}</td>
                                        <td className="py-1.5 text-right tabular-nums">{usd(s.usage[k].costUsd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-xs text-[var(--text-3)] mt-2">
                            Peak {s.behaviour.maxRequestsPerMinute} requests in a minute and {s.behaviour.maxRepeatedRequests} identical requests in the last 24 hours;
                            limit hit on {s.behaviour.limitHitDays7} of the last 7 days.
                        </p>
                    </Section>

                    <Section title="Requests by feature (30 days)">
                        <HBars
                            color={COLORS.blue}
                            rows={Object.entries(s.byFeature30)
                                .sort((a, b) => b[1] - a[1])
                                .map(([label, value]) => ({ label, value }))}
                        />
                    </Section>

                    <Section title="Recent requests">
                        {s.recentRequests.length === 0 ? (
                            <p className="text-sm text-[var(--text-3)]">None yet.</p>
                        ) : (
                            <table className="w-full text-xs">
                                <tbody>
                                    {s.recentRequests.map((r, i) => (
                                        <tr key={i} className="border-t border-[var(--border)]">
                                            <td className="py-1 text-[var(--text-3)]">{when(r.ts)}</td>
                                            <td className="py-1">{r.feature}</td>
                                            <td className="py-1">{r.status}</td>
                                            <td className="py-1 text-right tabular-nums">{r.credits} cr</td>
                                            <td className="py-1 text-right tabular-nums">{usd(r.costUsd)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </Section>

                    <Section title="Ban history">
                        {data.banHistory.length === 0 ? (
                            <p className="text-sm text-[var(--text-3)]">No bans or unbans on record.</p>
                        ) : (
                            <ul className="space-y-1 text-sm">
                                {data.banHistory.map((e) => (
                                    <li key={e._id}>
                                        <Badge variant={e.action === "ban" ? "danger" : "success"}>{e.action}</Badge>{" "}
                                        <span className="text-[var(--text-2)]">
                                            {when(e.at)} by {e.moderatorName ?? "a moderator"}
                                            {e.reason ? `: ${e.reason}` : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </div>
            )}
        </Modal>
    );
}
