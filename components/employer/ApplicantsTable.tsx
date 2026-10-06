"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { ApplicantDrawer } from "@/components/employer/ApplicantDrawer";
import { APP_STATUS_LABEL, ApplicationStatusPill } from "@/components/employer/Pills";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES, type ApplicantSummary, type ApplicationStatus } from "@/types/employer";

const BULK_TARGETS: ApplicationStatus[] = ["under_review", "shortlisted", "interview", "offered", "hired", "rejected"];
const selectCls = "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm";
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

interface Props {
    companyId: string;
    /** Set for the per-internship tab; omit for the company-wide page (adds an internship filter). */
    internshipId?: string;
}

export function ApplicantsTable({ companyId, internshipId }: Props) {
    const [status, setStatus] = useState("all");
    const [sort, setSort] = useState("date");
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [filterInternship, setFilterInternship] = useState("");
    const [items, setItems] = useState<ApplicantSummary[] | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [internships, setInternships] = useState<{ _id: string; name: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>("shortlisted");
    const [bulkBusy, setBulkBusy] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [tick, setTick] = useState(0); // bump to refetch

    // Debounce the search box
    useEffect(() => {
        const t = setTimeout(() => setQ(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let live = true;
        const base = `/api/employer/companies/${companyId}`;
        const params = new URLSearchParams({ sort });
        if (status !== "all") params.set("status", status);
        if (q.trim()) params.set("q", q.trim());
        const path = internshipId ? `${base}/internships/${internshipId}/applications` : `${base}/applications`;
        if (!internshipId && filterInternship) params.set("internshipId", filterInternship);

        fetch(`${path}?${params}`, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => {
                if (!live) return;
                if (!j.success) return setError(j.error);
                setError(null);
                setItems(j.data.items);
                setCounts(j.data.counts);
                if (j.data.internships) setInternships(j.data.internships);
            })
            .catch(() => live && setError("Unable to load applicants"));
        return () => { live = false; };
    }, [companyId, internshipId, status, sort, q, filterInternship, tick]);

    const refresh = useCallback(() => setTick((t) => t + 1), []);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const allSelected = !!items?.length && items.every((i) => selected.has(i._id));

    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const applyBulk = async () => {
        setBulkBusy(true);
        try {
            const res = await fetch(`/api/employer/companies/${companyId}/applications/bulk-status`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...selected], status: bulkStatus }),
            });
            const j = await res.json();
            if (!j.success) throw new Error(j.error);
            const { updated, failed } = j.data as { updated: string[]; failed: { id: string; error: string }[] };
            if (updated.length) toast.success(`${updated.length} moved to ${APP_STATUS_LABEL[bulkStatus]}`);
            if (failed.length) toast.error(`${failed.length} skipped: ${failed[0].error}`);
            setSelected(new Set());
            refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bulk update failed");
        } finally {
            setBulkBusy(false);
        }
    };

    const chips: [string, string, number][] = [["all", "All", total], ...APPLICATION_STATUSES.map((s) => [s, APP_STATUS_LABEL[s], counts[s] ?? 0] as [string, string, number])];

    return (
        <div className="max-w-6xl space-y-4">
            {/* Pipeline counts */}
            <div className="flex flex-wrap gap-2">
                {chips.map(([key, label, n]) => (
                    <button
                        key={key}
                        onClick={() => { setStatus(key); setItems(null); setSelected(new Set()); }}
                        className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            status === key ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                        )}
                    >
                        {label} <span className="opacity-75">{n}</span>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email or skill"
                        aria-label="Search applicants"
                        className={cn(selectCls, "w-64 pl-8")}
                    />
                </div>
                {!internshipId && (
                    <select className={selectCls} value={filterInternship} onChange={(e) => { setFilterInternship(e.target.value); setItems(null); }} aria-label="Filter by internship">
                        <option value="">All internships</option>
                        {internships.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
                    </select>
                )}
                <select className={selectCls} value={sort} onChange={(e) => { setSort(e.target.value); setItems(null); }} aria-label="Sort">
                    <option value="date">Newest first</option>
                    <option value="match">Best match</option>
                    <option value="rating">Highest rated</option>
                </select>
            </div>

            {/* Bulk bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] px-3 py-2 text-sm">
                    <span className="font-medium text-[var(--primary)]">{selected.size} selected</span>
                    <select className={selectCls} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as ApplicationStatus)} aria-label="Move selected to">
                        {BULK_TARGETS.map((s) => <option key={s} value={s}>Move to {APP_STATUS_LABEL[s]}</option>)}
                    </select>
                    <Button size="sm" loading={bulkBusy} onClick={applyBulk}>Apply</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                </div>
            )}

            {error ? (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : !items ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : items.length === 0 ? (
                <div className="plasma-card p-10 text-center">
                    <Users className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" />
                    <p className="font-medium text-[var(--text)]">{total === 0 ? "No applicants yet" : "No applicants match these filters"}</p>
                    <p className="mt-1 text-sm text-[var(--text-3)]">{total === 0 ? "Students who apply will show up here." : "Try a different status or search."}</p>
                </div>
            ) : (
                <div className="plasma-card overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-3)]">
                            <tr>
                                <th className="w-10 px-3 py-3">
                                    <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i._id)))} />
                                </th>
                                <th className="px-3 py-3 font-medium">Student</th>
                                {!internshipId && <th className="px-3 py-3 font-medium">Internship</th>}
                                <th className="px-3 py-3 font-medium">Match</th>
                                <th className="px-3 py-3 font-medium">Skills</th>
                                <th className="px-3 py-3 font-medium">Status</th>
                                <th className="px-3 py-3 font-medium">Rating</th>
                                <th className="px-3 py-3 font-medium">Applied</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((a) => (
                                <tr key={a._id} className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)]" onClick={() => setOpenId(a._id)}>
                                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" aria-label={`Select ${a.studentName}`} checked={selected.has(a._id)} onChange={() => toggle(a._id)} />
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <Avatar src={a.studentPicture} name={a.studentName} size="sm" />
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-[var(--text)]">{a.studentName}</p>
                                                <p className="truncate text-xs text-[var(--text-3)]">{a.studentEmail}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {!internshipId && <td className="max-w-[160px] truncate px-3 py-3 text-[var(--text-2)]">{a.internshipName}</td>}
                                    <td className="px-3 py-3">
                                        {a.matchScore == null ? "-" : (
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-3)]">
                                                    <div className="h-full bg-[var(--primary)]" style={{ width: `${Math.round(a.matchScore * 100)}%` }} />
                                                </div>
                                                <span className="text-xs tabular-nums">{Math.round(a.matchScore * 100)}%</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="max-w-[200px] truncate px-3 py-3 text-xs text-[var(--text-2)]">
                                        {a.skills.slice(0, 3).join(", ")}{a.skills.length > 3 && ` +${a.skills.length - 3}`}
                                    </td>
                                    <td className="px-3 py-3"><ApplicationStatusPill status={a.status} /></td>
                                    <td className="px-3 py-3">
                                        {a.rating ? <span className="inline-flex items-center gap-0.5 text-xs"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{a.rating}</span> : <span className="text-[var(--text-3)]">-</span>}
                                    </td>
                                    <td className="px-3 py-3 text-[var(--text-2)]">{fmt(a.appliedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ApplicantDrawer key={openId ?? "closed"} companyId={companyId} applicationId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
        </div>
    );
}
