"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

interface Profile { name: string; email: string; phone: string | null; designation: string | null; profilePicture: string | null }

export default function ProfilePage() {
    const router = useRouter();
    const [p, setP] = useState<Profile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/employer/profile", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => (j.success ? setP(j.data) : setError(j.error)))
            .catch(() => setError("Unable to load profile"));
    }, []);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!p) return;
        setSaving(true);
        try {
            const res = await fetch("/api/employer/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: p.name, phone: p.phone || null, designation: p.designation || null, profilePicture: p.profilePicture || null }),
            });
            const j = await res.json();
            if (!j.success) throw new Error(j.error);
            toast.success("Profile saved");
            router.refresh(); // update sidebar name/avatar
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-xl">
            <h1 className="text-lg font-bold text-[var(--text)] mb-6">Profile</h1>
            {error ? (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : !p ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
                <form onSubmit={save} className="plasma-card p-5 space-y-4">
                    <Input label="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required maxLength={100} />
                    <Input label="Email" value={p.email} disabled hint="Email can't be changed" readOnly />
                    <Input label="Phone" value={p.phone ?? ""} onChange={(e) => setP({ ...p, phone: e.target.value })} maxLength={20} />
                    <Input label="Designation" value={p.designation ?? ""} onChange={(e) => setP({ ...p, designation: e.target.value })} maxLength={80} />
                    <Input label="Picture URL" value={p.profilePicture ?? ""} onChange={(e) => setP({ ...p, profilePicture: e.target.value })} placeholder="https://…" />
                    <Button type="submit" loading={saving}>Save changes</Button>
                </form>
            )}
        </main>
    );
}
