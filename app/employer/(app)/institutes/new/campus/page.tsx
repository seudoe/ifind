"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { CampusForm, type CampusFormData } from "@/components/employer/CampusForm";
import { JoinCodeCard } from "@/components/employer/JoinCodeCard";
import { Button } from "@/components/ui/Button";

export default function NewCampusPage() {
    const router = useRouter();
    const [created, setCreated] = useState<{ id: string; code: string; name: string } | null>(null);

    const onSubmit = async (data: CampusFormData, collegeId?: string) => {
        try {
            const res = await fetch("/api/employer/campus", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ ...data, collegeId }),
            });
            const j = await res.json();
            if (!j.success) return j.error as string;
            setCreated({ id: j.data._id, code: j.data.joinCode, name: data.name });
            return null;
        } catch {
            return "Unable to create campus";
        }
    };

    if (created) {
        return (
            <main className="flex-1 min-w-0 p-4 md:p-8 max-w-2xl space-y-5">
                <div className="flex items-center gap-2 text-[var(--campus)]">
                    <CircleCheck className="h-5 w-5" />
                    <h1 className="text-lg font-bold text-[var(--heading)]">Campus created</h1>
                </div>
                <p className="text-sm text-[var(--text-2)]">Share the code below with your students. They need it to find your campus among any look-alikes.</p>
                <JoinCodeCard entityId={created.id} name={created.name} code={created.code} canRotate={false} />
                <Button onClick={() => router.push(`/employer/campus/${created.id}/overview`)}>Go to campus</Button>
            </main>
        );
    }

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-2xl">
            <Link href="/employer/institutes/new" className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">← Institutes</Link>
            <h1 className="text-lg font-bold text-[var(--heading)] mt-1 mb-6">Set up a college campus</h1>
            <CampusForm mode="create" onSubmit={onSubmit} />
        </main>
    );
}
