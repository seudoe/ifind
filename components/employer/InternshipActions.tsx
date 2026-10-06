"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { InternshipStatus } from "@/types/employer";

interface Action { key: string; label: string; help: string; show: InternshipStatus[]; danger?: boolean; confirm?: string }

const ACTIONS: Action[] = [
    { key: "publish", label: "Publish", help: "Submit for moderator review and open applications.", show: ["draft"] },
    { key: "publish", label: "Resume", help: "Start accepting applications again.", show: ["paused"] },
    { key: "pause", label: "Pause", help: "Temporarily stop accepting applications.", show: ["published"] },
    { key: "close", label: "Close", help: "Stop accepting applications for good.", show: ["published", "paused"], danger: true, confirm: "Close this internship? It can't be reopened, but you can duplicate it." },
    { key: "archive", label: "Archive", help: "Move a closed internship out of the way.", show: ["closed"], danger: true, confirm: "Archive this internship?" },
    { key: "duplicate", label: "Duplicate", help: "Copy into a new draft (applications are not copied).", show: ["draft", "published", "paused", "closed", "archived"] },
    { key: "delete", label: "Delete draft", help: "Permanently delete this draft.", show: ["draft"], danger: true, confirm: "Delete this draft permanently?" },
];

export function InternshipActions({ companyId, internshipId, status }: { companyId: string; internshipId: string; status: InternshipStatus }) {
    const router = useRouter();
    const [pending, setPending] = useState<Action | null>(null);
    const [busy, setBusy] = useState(false);
    const base = `/api/employer/companies/${companyId}/internships`;

    const run = async (a: Action) => {
        setBusy(true);
        try {
            const res = await fetch(a.key === "delete" ? `${base}/${internshipId}` : `${base}/${internshipId}/${a.key}`, {
                method: a.key === "delete" ? "DELETE" : "POST",
                credentials: "include",
            });
            const j = await res.json();
            if (!j.success) throw new Error(j.error);
            setPending(null);
            if (a.key === "delete") return void router.push(`/employer/company/${companyId}/internships`);
            if (a.key === "duplicate") {
                toast.success("Duplicated as a draft");
                return void router.push(`/employer/company/${companyId}/internships/${j.data._id}/internship-details`);
            }
            toast.success(`${a.label} done`);
            router.refresh();
        } catch (err) {
            setPending(null);
            toast.error(err instanceof Error ? err.message : "Action failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-3">
            {ACTIONS.filter((a) => a.show.includes(status)).map((a) => (
                <div key={a.label} className="plasma-card p-4 flex items-center justify-between gap-4">
                    <p className="text-sm text-[var(--text-2)]">{a.help}</p>
                    <Button variant={a.danger ? "danger" : "secondary"} size="sm" disabled={busy} onClick={() => (a.confirm ? setPending(a) : run(a))}>
                        {a.label}
                    </Button>
                </div>
            ))}
            <Modal open={!!pending} onClose={() => setPending(null)} title={pending?.label} size="sm">
                <p className="text-sm text-[var(--text-2)] mb-4">{pending?.confirm}</p>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                    <Button variant="danger" loading={busy} onClick={() => pending && run(pending)}>{pending?.label}</Button>
                </div>
            </Modal>
        </div>
    );
}
