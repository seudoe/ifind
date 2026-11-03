"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { CampusStudentsTable } from "@/components/employer/CampusStudentsTable";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface Banned { studentId: string; name: string; email: string; collegeUid: string | null; reason: string; bannedBy: string; bannedAt: string }

function Blacklist({ entityId, canEdit }: { entityId: string; canEdit: boolean }) {
    const [rows, setRows] = useState<Banned[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const load = useCallback(async () => {
        const j = await fetch(`/api/employer/campus/${entityId}/blacklist`, { credentials: "include" }).then((r) => r.json()).catch(() => ({ success: false, error: "Unable to load the blacklist" }));
        if (j.success) { setRows(j.data); setError(null); } else setError(j.error);
    }, [entityId]);
    useEffect(() => {
        let live = true;
        fetch(`/api/employer/campus/${entityId}/blacklist`, { credentials: "include" }).then((r) => r.json())
            .then((j) => { if (!live) return; if (j.success) setRows(j.data); else setError(j.error); })
            .catch(() => live && setError("Unable to load the blacklist"));
        return () => { live = false; };
    }, [entityId]);

    const unban = async (b: Banned) => {
        const j = await fetch(`/api/employer/campus/${entityId}/blacklist?studentId=${b.studentId}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()).catch(() => ({ success: false, error: "Failed" }));
        if (!j.success) return toast.error(j.error);
        toast.success(`${b.name} can apply again`);
        await load();
    };

    if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
    if (!rows) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
    if (!rows.length) return <div className="plasma-card p-10 text-center"><ShieldBan className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" /><p className="text-sm text-[var(--text-2)]">Nobody is barred from this campus&apos;s internships.</p></div>;
    return (
        <div className="plasma-card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs font-mono uppercase tracking-[0.07em] text-[var(--text-3)]"><tr><th className="px-4 py-3 font-medium">Student</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">By</th>{canEdit && <th className="px-4 py-3" />}</tr></thead>
                <tbody>
                    {rows.map((b) => (
                        <tr key={b.studentId} className="border-t border-[var(--border)]">
                            <td className="px-4 py-3"><p className="font-medium text-[var(--text)]">{b.name}</p><p className="text-xs text-[var(--text-3)]">{b.collegeUid ?? "-"} · {b.email}</p></td>
                            <td className="px-4 py-3 text-[var(--text-2)]">{b.reason}</td>
                            <td className="px-4 py-3 text-[var(--text-2)]">{b.bannedBy}<span className="block text-xs text-[var(--text-3)]">{new Date(b.bannedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></td>
                            {canEdit && <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => unban(b)}>Unban</Button></td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Students tab with the Blacklist beside it. Coordinators and above can remove, ban, unban and export. */
export function CampusStudentsArea({ entityId, canEdit }: { entityId: string; canEdit: boolean }) {
    const [tab, setTab] = useState<"students" | "blacklist">("students");
    return (
        <div className="max-w-5xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]">
                <div className="flex gap-1">
                    {(["students", "blacklist"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)} className={cn("border-b-2 -mb-px px-3 py-2 text-sm font-medium capitalize", tab === t ? "border-[var(--campus)] text-[var(--campus)]" : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]")}>{t}</button>
                    ))}
                </div>
                {canEdit && (
                    <details className="relative mb-1">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"><Download className="h-4 w-4" /> Export all applicants</summary>
                        <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                            {(["csv", "xlsx", "json"] as const).map((f) => <a key={f} href={`/api/employer/campus/${entityId}/export?format=${f}`} download className="block px-3 py-2 text-sm uppercase hover:bg-[var(--surface-2)]">{f}</a>)}
                        </div>
                    </details>
                )}
            </div>
            {tab === "students" ? <CampusStudentsTable entityId={entityId} canEdit={canEdit} /> : <Blacklist entityId={entityId} canEdit={canEdit} />}
        </div>
    );
}
