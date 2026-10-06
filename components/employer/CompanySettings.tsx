"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CompanyForm } from "@/components/employer/CompanyForm";
import { VerificationBadge } from "@/components/employer/VerificationBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { CompanyInput } from "@/lib/employer/validation";
import type { Company } from "@/types/employer";

interface Props {
    companyId: string;
    initial: Partial<CompanyInput>;
    verification: Company["verification"];
    isOwner: boolean;
}

export function CompanySettings({ companyId, initial, verification, isOwner }: Props) {
    const router = useRouter();
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const save = async (data: CompanyInput) => {
        const res = await fetch(`/api/employer/companies/${companyId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
        });
        const j = await res.json();
        if (!j.success) return j.error as string;
        toast.success("Company updated");
        router.refresh();
        return null;
    };

    const remove = async () => {
        setDeleting(true);
        const res = await fetch(`/api/employer/companies/${companyId}`, { method: "DELETE", credentials: "include" });
        const j = await res.json();
        setDeleting(false);
        if (!j.success) {
            setConfirm(false);
            return toast.error(j.error);
        }
        router.push("/employer/companies");
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text)]">Company settings</h1>
                <VerificationBadge status={verification?.status ?? "unverified"} />
            </div>

            <CompanyForm mode="edit" initial={initial} onSubmit={save} />

            {isOwner && (
                <div className="plasma-card p-5 space-y-3 border-[var(--danger)]/40">
                    <h2 className="font-semibold text-[var(--danger)]">Danger zone</h2>
                    <p className="text-sm text-[var(--text-2)]">
                        Deleting the company closes its drafts and hides it from everyone. Close all published or paused internships first.
                    </p>
                    <Button variant="danger" onClick={() => setConfirm(true)}>Delete company</Button>
                    <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this company?" size="sm">
                        <p className="text-sm text-[var(--text-2)] mb-4">This can&apos;t be undone from the UI.</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
                            <Button variant="danger" loading={deleting} onClick={remove}>Delete</Button>
                        </div>
                    </Modal>
                </div>
            )}
        </div>
    );
}
