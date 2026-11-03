"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CampusForm, type CampusFormData } from "@/components/employer/CampusForm";
import { JoinCodeCard } from "@/components/employer/JoinCodeCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface Props {
    entityId: string;
    name: string;
    initial: Partial<CampusFormData>;
    joinCode?: string;
    canEdit: boolean;
    canRotate: boolean;
    isOwner: boolean;
}

export function CampusSettings({ entityId, name, initial, joinCode, canEdit, canRotate, isOwner }: Props) {
    const router = useRouter();
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const save = async (data: CampusFormData) => {
        const res = await fetch(`/api/employer/campus/${entityId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
        });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to save" }));
        if (!j.success) return j.error as string;
        toast.success("Campus updated");
        router.refresh();
        return null;
    };

    const remove = async () => {
        setDeleting(true);
        const res = await fetch(`/api/employer/campus/${entityId}`, { method: "DELETE", credentials: "include" });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to delete campus" }));
        setDeleting(false);
        if (!j.success) {
            setConfirm(false);
            return toast.error(j.error);
        }
        router.push("/employer/institutes");
    };

    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-lg font-bold text-[var(--heading)]">Campus settings</h1>
            {joinCode && <JoinCodeCard entityId={entityId} name={name} code={joinCode} canRotate={canRotate} />}
            {canEdit ? (
                <CampusForm mode="edit" initial={initial} onSubmit={save} />
            ) : (
                <p className="plasma-card p-5 text-sm text-[var(--text-2)]">Only admins and owners can change these settings.</p>
            )}
            {isOwner && (
                <div className="plasma-card p-5 space-y-3 border-[var(--danger)]/40">
                    <h2 className="font-semibold text-[var(--danger)]">Danger zone</h2>
                    <p className="text-sm text-[var(--text-2)]">
                        Deleting this campus closes its internships, withdraws every active application and removes joined students from it. Applications stay on record. Other campuses of the same college are not affected.
                    </p>
                    <Button variant="danger" onClick={() => setConfirm(true)}>Delete campus</Button>
                    <Modal open={confirm} onClose={() => setConfirm(false)} title={`Delete ${name}?`} size="sm">
                        <p className="text-sm text-[var(--text-2)] mb-4">Students will be notified. This can&apos;t be undone from the UI.</p>
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
