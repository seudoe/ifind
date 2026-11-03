"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ModAction, ModCampusRow } from "@/lib/campus/moderation";
import { cn } from "@/lib/utils";

type Status = "none" | "restricted" | "banned";

interface Detail {
    campus: { _id: string; name: string; slug: string; description: string; college: string | null; listing: string; restriction: { status: Status; reason?: string | null; at?: string | null }; reportCount: number; studentCount: number; isActive: boolean; deleted: boolean; createdAt: string };
    members: { employerId: string; role: string; name: string; email: string; isBanned: boolean }[];
    reports: { reason: string; note: string | null; student: string; at: string }[];
    history: { _id: string; action: "ban" | "unban"; reason: string | null; moderatorName?: string | null; at: string }[];
    counts: { applications: number; barredStudents: number; internships: number };
}

const TH = "py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] font-mono uppercase tracking-[0.07em] whitespace-nowrap";
const INPUT = "px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors";
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");
const FILTERS = [["", "All"], ["reported", "Reported"], ["restricted", "Restricted"], ["banned", "Banned"], ["none", "Active"]] as const;
const REASON: Record<string, string> = { not_official: "Not official", wrong_college: "Wrong college", scam: "Scam", other: "Other" };

function StatusBadge({ status }: { status: Status }) {
    return status === "banned" ? <Badge variant="danger">Banned</Badge> : status === "restricted" ? <Badge variant="warning">Restricted</Badge> : <Badge variant="success">Active</Badge>;
}

/** Restrict / Ban each ask for a reason; Lift is one click. */
function Controls({ status, onAct }: { status: Status; onAct: (a: ModAction, reason?: string) => Promise<void> }) {
    const [pending, setPending] = useState<Exclude<ModAction, "lift"> | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const run = async (a: ModAction, r?: string) => {
        setBusy(true);
        try { await onAct(a, r); setPending(null); setReason(""); } finally { setBusy(false); }
    };
    if (pending) {
        return (
            <div className="flex items-center gap-2">
                <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (setPending(null), setReason(""))} placeholder={`Reason to ${pending}...`} className={`${INPUT} !py-1 !text-xs w-44`} aria-label="Reason" />
                <Button variant="danger" size="sm" loading={busy} disabled={!reason.trim()} onClick={() => run(pending, reason.trim())}>Confirm</Button>
                <button onClick={() => { setPending(null); setReason(""); }} className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">Cancel</button>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            {status !== "none" && <Button variant="secondary" size="sm" loading={busy} onClick={() => run("lift")}>{status === "banned" ? "Unban" : "Unrestrict"}</Button>}
            {status === "none" && <Button variant="secondary" size="sm" onClick={() => setPending("restrict")}>Restrict</Button>}
            {status !== "banned" && <Button variant="danger" size="sm" onClick={() => setPending("ban")}>Ban</Button>}
        </div>
    );
}

/** Moderator view of college campuses: most reported first; restrict, ban or lift with a reason. */
export function CampusesPanel() {
    const [rows, setRows] = useState<ModCampusRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [status, setStatus] = useState<string>("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selected, setSelected] = useState<ModCampusRow | null>(null);
    const [detail, setDetail] = useState<Detail | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

    useEffect(() => {
        let live = true;
        const sp = new URLSearchParams({ page: String(page) });
        if (q) sp.set("search", q);
        if (status) sp.set("status", status);
        fetch(`/api/moderator/campuses?${sp}`, { credentials: "include" }).then((r) => r.json())
            .then((j) => { if (!live) return; if (j.success) { setRows(j.data); setTotalPages(j.totalPages || 1); } else toast.error(j.error); setLoading(false); })
            .catch(() => { if (live) { toast.error("Unable to load campuses"); setLoading(false); } });
        return () => { live = false; };
    }, [q, status, page, tick]);

    useEffect(() => {
        if (!selected) return;
        let live = true;
        fetch(`/api/moderator/campuses/${selected._id}`, { credentials: "include" }).then((r) => r.json())
            .then((j) => live && (j.success ? setDetail(j.data) : toast.error(j.error))).catch(() => live && toast.error("Unable to load the campus"));
        return () => { live = false; };
    }, [selected, tick]);

    const act = useCallback(async (id: string, action: ModAction, reason?: string) => {
        const res = await fetch(`/api/moderator/campuses/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
        const j = await res.json().catch(() => ({ success: false, error: "Failed" }));
        if (!j.success) { toast.error(j.error); return; }
        toast.success(action === "lift" ? "Restriction lifted" : action === "ban" ? `Banned. ${j.data.studentsDetached} student(s) detached.` : "Restricted");
        setTick((t) => t + 1);
    }, []);

    const d = detail;
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campus, college, email" aria-label="Search campuses" className={`${INPUT} w-72 max-w-full`} />
                <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map(([key, label]) => (
                        <button key={key} onClick={() => { setStatus(key); setPage(1); setLoading(true); }} className={cn("rounded-full border px-3 py-1 text-xs font-medium", status === key ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]")}>{label}</button>
                    ))}
                </div>
            </div>

            {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /></div> : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-[var(--text-3)]"><SearchX className="h-8 w-8" /><p className="text-sm">No campuses found</p></div>
            ) : (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
                    <table className="w-full min-w-[760px] text-left">
                        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <tr><th className={TH}>Campus</th><th className={TH}>College</th><th className={`${TH} text-center`}>Reports</th><th className={`${TH} text-center`}>Students</th><th className={`${TH} text-center`}>Staff</th><th className={TH}>Status</th><th className={TH}>Actions</th></tr>
                        </thead>
                        <tbody className="bg-[var(--surface)]">
                            {rows.map((c) => (
                                <tr key={c._id} className="border-b border-[var(--border)] last:border-0">
                                    <td className="py-3 px-4"><button type="button" onClick={() => { setDetail(null); setSelected(c); }} className="block max-w-[16rem] truncate text-left text-sm font-medium text-[var(--text)] hover:text-[var(--primary)] hover:underline">{c.name}</button><p className="text-xs text-[var(--text-3)]">by {c.creator}{c.deleted ? " · deleted" : ""}</p></td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)]">{c.college ?? "-"}</td>
                                    <td className={cn("py-3 px-4 text-center text-sm tabular-nums", c.reportCount > 0 ? "font-semibold text-[var(--danger)]" : "text-[var(--text-2)]")}>{c.reportCount}</td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)] text-center tabular-nums">{c.studentCount}</td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)] text-center tabular-nums">{c.memberCount}</td>
                                    <td className="py-3 px-4"><StatusBadge status={c.restriction.status} /></td>
                                    <td className="py-3 px-4">{c.deleted ? <span className="text-xs text-[var(--text-3)]">-</span> : (
                                        <div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={() => { setDetail(null); setSelected(c); }}>Details</Button><Controls status={c.restriction.status} onAct={(a, r) => act(c._id, a, r)} /></div>
                                    )}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <span className="text-xs text-[var(--text-2)]">Page {page} of {totalPages}</span>
                    <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
            )}

            <Modal open={!!selected} onClose={() => { setSelected(null); setDetail(null); }} size="xl" title={selected?.name} description={d?.campus.college ?? undefined}>
                {!d ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /></div> : (
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={d.campus.restriction.status} /><Badge variant="outline">{d.campus.listing === "listed" ? "Listed" : "Code only"}</Badge><Badge variant={d.campus.reportCount ? "danger" : "secondary"}>{d.campus.reportCount} reported</Badge></div>
                            {!d.campus.deleted && <Controls status={d.campus.restriction.status} onAct={(a, r) => act(d.campus._id, a, r)} />}
                        </div>
                        {d.campus.restriction.status !== "none" && <p className="text-sm text-[var(--danger)]">{d.campus.restriction.status === "banned" ? "Banned" : "Restricted"} {when(d.campus.restriction.at)}{d.campus.restriction.reason ? `: ${d.campus.restriction.reason}` : ""}</p>}
                        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                            {[["Students", d.campus.studentCount], ["Internships", d.counts.internships], ["Applications", d.counts.applications], ["Barred students", d.counts.barredStudents]].map(([l, v]) => <div key={String(l)}><dt className="text-xs text-[var(--text-3)]">{l}</dt><dd className="text-[var(--text)]">{v}</dd></div>)}
                        </dl>
                        {d.campus.description && <p className="whitespace-pre-wrap text-sm text-[var(--text-2)]">{d.campus.description}</p>}

                        <section><h4 className="mb-2 text-xs font-semibold font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">Staff ({d.members.length})</h4>
                            <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-sm)] border border-[var(--border)]">
                                {d.members.map((m) => <li key={m.employerId} className="flex items-center gap-2 px-3 py-2 text-sm"><span className="font-medium text-[var(--text)]">{m.name}</span><span className="truncate text-xs text-[var(--text-3)]">{m.email}</span><span className="ml-auto flex items-center gap-1.5">{m.isBanned && <Badge variant="danger">banned</Badge>}<Badge variant="default">{m.role}</Badge></span></li>)}
                            </ul>
                        </section>

                        <section><h4 className="mb-2 text-xs font-semibold font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">Reports ({d.reports.length})</h4>
                            {d.reports.length === 0 ? <p className="text-sm text-[var(--text-3)]">None.</p> : (
                                <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">{d.reports.map((r, i) => <li key={i}><Badge variant="warning">{REASON[r.reason] ?? r.reason}</Badge> <span className="text-[var(--text-2)]">{r.student} · {when(r.at)}{r.note ? `: ${r.note}` : ""}</span></li>)}</ul>
                            )}
                        </section>

                        <section><h4 className="mb-2 text-xs font-semibold font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">Restriction history</h4>
                            {d.history.length === 0 ? <p className="text-sm text-[var(--text-3)]">Nothing on record.</p> : (
                                <ul className="space-y-1.5 text-sm">{d.history.map((h) => <li key={h._id}><Badge variant={h.action === "ban" ? "danger" : "success"}>{h.action === "ban" ? "applied" : "lifted"}</Badge> <span className="text-[var(--text-2)]">{when(h.at)} by {h.moderatorName ?? "moderator"}{h.reason ? `: ${h.reason}` : ""}</span></li>)}</ul>
                            )}
                        </section>
                    </div>
                )}
            </Modal>
        </div>
    );
}
