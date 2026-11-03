"use client";

import { useState } from "react";
import { Flag, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { LeaveSwitchDialog, ReportDialog } from "@/components/student/campus/CampusDialogs";
import { useCampus } from "@/components/student/campus/CampusProvider";
import { CollegeDetailsForm } from "@/components/student/campus/CollegeDetailsForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function CollegeDetailsPage() {
    const { state, refresh } = useCampus();
    const [dialog, setDialog] = useState<"leave" | "report" | null>(null);
    if (!state?.enrollment) return null;
    const c = state.current;
    const done = async () => { setDialog(null); await refresh(); };
    const e = state.enrollment;

    const pref = async (patch: { emailUpdates?: boolean; smsUpdates?: boolean }) => {
        const res = await fetch("/api/user/campus/preferences", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to save" }));
        if (!j.success) return toast.error(j.error);
        await refresh();
    };

    return (
        <div className="space-y-6">
            {c ? (
                <section className="plasma-card p-4 border-l-4 border-l-[var(--campus)] space-y-3 max-w-2xl">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--campus-bg)]"><GraduationCap className="h-5 w-5 text-[var(--campus)]" /></div>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[var(--text)]">{c.name}</p>
                            <p className="text-xs text-[var(--text-2)]">Set up by {c.creatorName} · {c.staffCount} staff · {c.studentCount} student{c.studentCount === 1 ? "" : "s"}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <Badge variant="success">Joined</Badge>
                                {c.reportCount > 0 && <Badge variant="danger">{c.reportCount} student{c.reportCount === 1 ? "" : "s"} reported this campus</Badge>}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setDialog("report")}><Flag className="h-3.5 w-3.5" /> {c.myReport ? "Edit or retract report" : "Report"}</Button>
                        <Button size="sm" variant="danger" onClick={() => setDialog("leave")}>Switch campus / Leave</Button>
                    </div>
                </section>
            ) : null}

            <section className="plasma-card p-4 max-w-2xl space-y-2">
                <h2 className="font-semibold text-[var(--heading)]">Messages from your campus</h2>
                <label className="flex items-start gap-2 text-sm text-[var(--text)]"><input type="checkbox" className="mt-1 accent-[var(--campus)]" checked={e.emailUpdates} onChange={(ev) => pref({ emailUpdates: ev.target.checked })} /> Email me about new internships, events and my applications</label>
                <label className="flex items-start gap-2 text-sm text-[var(--text)]"><input type="checkbox" className="mt-1 accent-[var(--campus)]" checked={e.smsUpdates} disabled={!e.phone} onChange={(ev) => pref({ smsUpdates: ev.target.checked })} /> Text me on my phone{!e.phone && <span className="text-xs text-[var(--text-3)]"> (save a phone number below first)</span>}</label>
                <p className="text-xs text-[var(--text-3)]">You always get an in-app notice. Account and safety messages are not affected.</p>
            </section>

            <CollegeDetailsForm initial={state.enrollment} college={state.college} current={c} onSaved={refresh} />

            {dialog === "leave" && c && <LeaveSwitchDialog current={c} onClose={() => setDialog(null)} onDone={done} />}
            {dialog === "report" && c && <ReportDialog campus={c} onClose={() => setDialog(null)} onDone={done} />}
        </div>
    );
}
