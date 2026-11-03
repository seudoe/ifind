"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Search, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { CAMPUS_STATUS_LABEL, CampusApplicationPill } from "@/components/campus/CampusApplicationPill";
import { CampusApplicantDrawer } from "@/components/employer/CampusApplicantDrawer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ApplicantRow } from "@/lib/campus/applicants";
import { cn } from "@/lib/utils";
import { CAMPUS_APPLICATION_STATUSES, type CampusApplicationStatus } from "@/types/campus";

const BULK: CampusApplicationStatus[] = ["shortlisted", "in_process", "offered", "rejected"];
const selectCls = "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm";
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

interface Props {
    entityId: string;
    /** Set for the per-internship tab. */
    internshipId?: string;
    canEdit: boolean;
}

export function CampusApplicantsTable({ entityId, internshipId, canEdit }: Props) {
    const [status, setStatus] = useState("all");
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [items, setItems] = useState<ApplicantRow[] | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulk, setBulk] = useState<CampusApplicationStatus>("shortlisted");
    const [busy, setBusy] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setQ(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let live = true;
        const params = new URLSearchParams();
        if (internshipId) params.set("internshipId", internshipId);
        if (status !== "all") params.set("status", status);
        if (q.trim()) params.set("q", q.trim());
        fetch(`/api/employer/campus/${entityId}/applications?${params}`, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => { if (!live) return; if (!j.success) return setError(j.error); setError(null); setItems(j.data.items); setCounts(j.data.counts); })
            .catch(() => live && setError("Unable to load applicants"));
        return () => { live = false; };
    }, [entityId, internshipId, status, q, tick]);

    const refresh = useCallback(() => setTick((t) => t + 1), []);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const allSelected = !!items?.length && items.every((i) => selected.has(i._id));

    const applyBulk = async () => {
        setBusy(true);
        const res = await fetch(`/api/employer/campus/${entityId}/applications/bulk-status`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected], status: bulk }),
        });
        const j = await res.json().catch(() => ({ success: false, error: "Bulk update failed" }));
        setBusy(false);
        if (!j.success) return toast.error(j.error);
        const { updated, failed } = j.data as { updated: string[]; failed: { id: string; error: string }[] };
        if (updated.length) toast.success(`${updated.length} moved to ${CAMPUS_STATUS_LABEL[bulk]}`);
        if (failed.length) toast.error(`${failed.length} skipped: ${failed[0].error}`);
        setSelected(new Set());
        refresh();
    };

    const exportHref = (format: string) => `/api/employer/campus/${entityId}/export?format=${format}${internshipId ? `&internshipId=${internshipId}` : ""}`;
    const chips: [string, string, number][] = [["all", "All", total], ...CAMPUS_APPLICATION_STATUSES.map((s) => [s, CAMPUS_STATUS_LABEL[s], counts[s] ?? 0] as [string, string, number])];

    return (
        <div className="max-w-6xl space-y-4">
            <div className="flex flex-wrap gap-2">
                {chips.map(([key, label, n]) => (
                    <button key={key} onClick={() => { setStatus(key); setItems(null); setSelected(new Set()); }}
                        className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", status === key ? "border-[var(--campus)] bg-[var(--campus)] text-white" : "border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]")}>
                        {label} <span className="opacity-75">{n}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, course" aria-label="Search applicants" className={`${selectCls} pl-8 w-64`} />
                </div>
                {canEdit && (
                    <details className="relative ml-auto">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"><Download className="h-4 w-4" /> Export</summary>
                        <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                            {(["csv", "xlsx", "json"] as const).map((f) => <a key={f} href={exportHref(f)} download className="block px-3 py-2 text-sm uppercase hover:bg-[var(--surface-2)]">{f}</a>)}
                        </div>
                    </details>
                )}
            </div>

            {canEdit && selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--campus-bg)] px-3 py-2 text-sm">
                    <span>{selected.size} selected</span>
                    <select className={selectCls} value={bulk} onChange={(e) => setBulk(e.target.value as CampusApplicationStatus)} aria-label="Move to">
                        {BULK.map((s) => <option key={s} value={s}>{CAMPUS_STATUS_LABEL[s]}</option>)}
                    </select>
                    <Button size="sm" loading={busy} onClick={applyBulk}>Apply</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                </div>
            )}

            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : !items ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : items.length === 0 ? (
                <div className="plasma-card p-10 text-center"><Users className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" /><p className="text-sm text-[var(--text-2)]">{q || status !== "all" ? "No applicant matches." : "No applications yet."}</p></div>
            ) : (
                <div className="plasma-card overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="text-left text-xs font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">
                            <tr>
                                {canEdit && <th className="w-8 px-3 py-3"><input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i._id)))} className="accent-[var(--campus)]" /></th>}
                                <th className="px-3 py-3 font-medium">Applicant</th>
                                {!internshipId && <th className="px-3 py-3 font-medium">Internship</th>}
                                <th className="px-3 py-3 font-medium">Status</th>
                                <th className="px-3 py-3 font-medium text-right">CGPA</th>
                                <th className="px-3 py-3 font-medium">Applied</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((a) => (
                                <tr key={a._id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
                                    {canEdit && <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a._id)} onChange={() => toggle(a._id)} className="accent-[var(--campus)]" /></td>}
                                    <td className="px-3 py-3">
                                        <button onClick={() => setOpenId(a._id)} className="text-left font-medium text-[var(--text)] hover:text-[var(--campus)]">{a.name}</button>
                                        <p className="text-xs text-[var(--text-3)]"><span className="font-mono">{a.uid}</span> · {a.course}, {a.department} · {a.batch}</p>
                                    </td>
                                    {!internshipId && <td className="px-3 py-3 text-[var(--text-2)]">{a.company}<span className="block text-xs text-[var(--text-3)]">{a.designation}</span></td>}
                                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><CampusApplicationPill status={a.status as CampusApplicationStatus} />{a.rating ? <span className="inline-flex items-center text-xs text-amber-600"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{a.rating}</span> : null}</span></td>
                                    <td className="px-3 py-3 text-right tabular-nums">{a.cgpa ?? "-"}</td>
                                    <td className="px-3 py-3 text-[var(--text-2)]">{fmt(a.appliedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {openId && <CampusApplicantDrawer entityId={entityId} applicationId={openId} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={refresh} />}
        </div>
    );
}
