"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CampusForm, type CampusFormData } from "@/components/employer/CampusForm";
import { JoinCodeCard } from "@/components/employer/JoinCodeCard";

interface Props {
    entityId: string;
    name: string;
    initial: Partial<CampusFormData>;
    joinCode?: string;
    canEdit: boolean;
    canRotate: boolean;
}

export function CampusSettings({ entityId, name, initial, joinCode, canEdit, canRotate }: Props) {
    const router = useRouter();

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

    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="text-lg font-bold text-[var(--heading)]">Campus settings</h1>
            {joinCode && <JoinCodeCard entityId={entityId} name={name} code={joinCode} canRotate={canRotate} />}
            {canEdit ? (
                <CampusForm mode="edit" initial={initial} onSubmit={save} />
            ) : (
                <p className="plasma-card p-5 text-sm text-[var(--text-2)]">Only admins and owners can change these settings.</p>
            )}
        </div>
    );
}
