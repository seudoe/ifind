"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, GraduationCap, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { JoinDialog, LeaveSwitchDialog, ReportDialog, type Target } from "@/components/student/campus/CampusDialogs";
import { useCampus } from "@/components/student/campus/CampusProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { NO_ENTITY_BODY } from "@/lib/campus/copy";
import type { CampusSummaryView } from "@/types/campusStudent";

type Dialog = { kind: "join"; target: Target } | { kind: "switch"; target: Target } | { kind: "report"; campus: CampusSummaryView } | null;

export default function CampusesPage() {
    const { state, refresh } = useCampus();
    const [items, setItems] = useState<CampusSummaryView[] | null>(null);
    const [code, setCode] = useState("");
    const [looking, setLooking] = useState(false);
    const [dialog, setDialog] = useState<Dialog>(null);

    const load = useCallback(async () => {
        const res = await fetch("/api/user/campus/entities", { credentials: "include" });
        const j = await res.json().catch(() => null);
        setItems(j?.success ? j.data.items : []);
    }, []);
    useEffect(() => {
        let live = true;
        fetch("/api/user/campus/entities", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => live && setItems(j?.success ? j.data.items : []))
            .catch(() => live && setItems([]));
        return () => { live = false; };
    }, []);

    const joinedId = state?.enrollment?.entityId ?? null;
    const open = (target: Target) => setDialog(joinedId && joinedId !== target.campus._id ? { kind: "switch", target } : { kind: "join", target });
    const done = async () => { setDialog(null); setCode(""); await Promise.all([refresh(), load()]); };

    const lookup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLooking(true);
        const res = await fetch("/api/user/campus/entities/lookup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to check that code" }));
        setLooking(false);
        if (!j.success) return toast.error(j.error);
        if (j.data.joined) return toast.info("You are already in this campus");
        open({ campus: j.data, code });
    };

    if (!state || !items) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-32" /></div>;

    return (
        <div className="space-y-6">
            <form onSubmit={lookup} className="plasma-card p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <Input label="Have a code?" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8-character code from your coordinator" maxLength={12} leftIcon={<KeyRound className="h-4 w-4" />} autoComplete="off" />
                </div>
                <Button type="submit" loading={looking} disabled={code.replace(/[\s-]/g, "").length < 8}>Find campus</Button>
            </form>

            {items.length === 0 ? (
                <div className="plasma-card p-8 text-center">
                    <GraduationCap className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" />
                    <p className="text-sm text-[var(--text)]">{NO_ENTITY_BODY}</p>
                    <p className="mt-1 text-xs text-[var(--text-3)]">You can still fill in your College details. If your coordinator already shared a code, enter it above.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-[var(--text-2)]">Several people can set up a campus for the same college. Join the one your placement coordinator shared with you.</p>
                    {items.map((c) => (
                        <div key={c._id} className={`plasma-card p-4 ${c.joined ? "border-l-4 border-l-[var(--campus)]" : ""}`}>
                            <div className="flex items-start gap-3">
                                {c.logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={c.logo} alt="" className="h-11 w-11 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                                ) : (
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--campus-bg)]"><GraduationCap className="h-5 w-5 text-[var(--campus)]" /></div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-[var(--text)]">{c.name}</p>
                                    <p className="text-xs text-[var(--text-2)]">Set up by {c.creatorName} · {c.staffCount} staff · {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {c.joined && <Badge variant="success">You are in this campus</Badge>}
                                        {c.reportCount > 0 && <Badge variant="danger">{c.reportCount} reported</Badge>}
                                        {c.myReport && <Badge variant="outline">You reported this</Badge>}
                                    </div>
                                    {c.description && <p className="mt-2 line-clamp-2 text-sm text-[var(--text-2)]">{c.description}</p>}
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setDialog({ kind: "report", campus: c })}><Flag className="h-3.5 w-3.5" /> {c.myReport ? "Reported" : "Report"}</Button>
                                {!c.joined && <Button size="sm" onClick={() => open({ campus: c })}>Join</Button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {dialog?.kind === "join" && <JoinDialog target={dialog.target} onClose={() => setDialog(null)} onDone={done} />}
            {dialog?.kind === "switch" && state.current && <LeaveSwitchDialog current={state.current} target={dialog.target} onClose={() => setDialog(null)} onDone={done} />}
            {dialog?.kind === "report" && <ReportDialog campus={dialog.campus} onClose={() => setDialog(null)} onDone={done} />}
        </div>
    );
}
