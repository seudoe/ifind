"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { ModerationPill, StatusPill } from "@/components/employer/Pills";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { INTERNSHIP_STATUSES, type PlatformInternship } from "@/types/employer";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

export function InternshipsTable({ companyId }: { companyId: string }) {
    const [filter, setFilter] = useState<string>("all");
    const [items, setItems] = useState<PlatformInternship[] | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        fetch(`/api/employer/companies/${companyId}/internships${filter === "all" ? "" : `?status=${filter}`}`, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => {
                if (!live) return;
                if (!j.success) return setError(j.error);
                setError(null);
                setItems(j.data.items);
                setCounts(j.data.counts);
            })
            .catch(() => live && setError("Unable to load internships"));
        return () => { live = false; };
    }, [companyId, filter]);

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const tabs = [["all", "All", total], ...INTERNSHIP_STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1), counts[s] ?? 0])] as [string, string, number][];
    const href = (i: PlatformInternship) => `/employer/company/${companyId}/internships/${i._id}/${i.status === "draft" ? "internship-details" : "overview"}`;

    return (
        <div className="max-w-5xl space-y-5">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-bold text-[var(--text)]">Internships</h1>
                <Link href={`/employer/company/${companyId}/post-new-internship`}>
                    <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New internship</Button>
                </Link>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
                {tabs.map(([key, label, n]) => (
                    <button
                        key={key}
                        onClick={() => { setItems(null); setFilter(key); }}
                        className={cn(
                            "whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                            filter === key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                        )}
                    >
                        {label} <span className="text-xs text-[var(--text-3)]">{n}</span>
                    </button>
                ))}
            </div>

            {error ? (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : !items ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : items.length === 0 ? (
                <div className="plasma-card p-10 text-center">
                    <Briefcase className="mx-auto h-9 w-9 text-[var(--text-3)] mb-2" />
                    <p className="text-sm text-[var(--text-2)] mb-4">{filter === "all" ? "No internships yet." : `No ${filter} internships.`}</p>
                    <Link href={`/employer/company/${companyId}/post-new-internship`}><Button>Post your first internship</Button></Link>
                </div>
            ) : (
                <div className="plasma-card overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-3)]">
                            <tr>
                                <th className="px-4 py-3 font-medium">Title</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Moderation</th>
                                <th className="px-4 py-3 font-medium text-right">Applicants</th>
                                <th className="px-4 py-3 font-medium">Deadline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((i) => (
                                <tr key={i._id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
                                    <td className="px-4 py-3">
                                        <Link href={href(i)} className="font-medium text-[var(--text)] hover:text-[var(--primary)]">{i.name}</Link>
                                        <p className="text-xs text-[var(--text-3)] capitalize">{i.workMode}{i.city ? `, ${i.city}` : ""}</p>
                                    </td>
                                    <td className="px-4 py-3"><StatusPill status={i.status} /></td>
                                    <td className="px-4 py-3">{i.status === "draft" ? <span className="text-[var(--text-3)]">-</span> : <ModerationPill status={i.moderation.status} />}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{i.applicantCount ?? 0}</td>
                                    <td className="px-4 py-3 text-[var(--text-2)]">{fmt(i.deadlineDate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
