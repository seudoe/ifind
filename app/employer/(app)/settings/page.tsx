"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import type { Employer } from "@/types/employer";

async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json();
    if (!j.success) throw new Error(j.error || "Request failed");
    return j;
}

export default function SettingsPage() {
    const router = useRouter();
    const [me, setMe] = useState<Employer | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const load = useCallback(() => {
        fetch("/api/employer/auth/me", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => (j.success ? setMe(j.data) : setLoadError(j.error)))
            .catch(() => setLoadError("Unable to load settings"));
    }, []);

    useEffect(() => {
        load();
        const q = new URLSearchParams(window.location.search);
        if (q.get("error")) toast.error(q.get("error")!);
        if (q.get("linked")) toast.success("LinkedIn linked");
    }, [load]);

    const run = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        try {
            await fn();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    };

    const savePassword = (e: React.FormEvent) => {
        e.preventDefault();
        run("pw", async () => {
            await api("/api/employer/account/password", "POST", { currentPassword: current, newPassword: next });
            toast.success("Password updated");
            setCurrent("");
            setNext("");
            load();
        });
    };

    const unlink = () =>
        run("unlink", async () => {
            await api("/api/employer/account/linkedin", "DELETE");
            toast.success("LinkedIn unlinked");
            load();
        });

    const deleteAccount = () =>
        run("delete", async () => {
            await api("/api/employer/account", "DELETE");
            router.push("/employer/login");
        });

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-xl space-y-6">
            <h1 className="text-lg font-bold text-[var(--text)]">Settings</h1>
            {loadError ? (
                <p className="text-sm text-[var(--danger)]">{loadError}</p>
            ) : !me ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
            ) : (
                <>
                    <form onSubmit={savePassword} className="plasma-card p-5 space-y-4">
                        <h2 className="font-semibold text-[var(--text)]">{me.hasPassword ? "Change password" : "Set a password"}</h2>
                        {!me.hasPassword && <p className="text-xs text-[var(--text-3)]">You signed up with LinkedIn. Set a password to also sign in with your email.</p>}
                        {me.hasPassword && (
                            <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
                        )}
                        <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} hint="Min 8 characters, 1 uppercase, 1 number" autoComplete="new-password" required />
                        <Button type="submit" loading={busy === "pw"}>{me.hasPassword ? "Update password" : "Set password"}</Button>
                    </form>

                    <div className="plasma-card p-5 space-y-3">
                        <h2 className="font-semibold text-[var(--text)]">LinkedIn</h2>
                        {me.linkedinLinked ? (
                            <>
                                <p className="text-sm text-[var(--text-2)]">Your LinkedIn account is linked.</p>
                                <Button variant="secondary" onClick={unlink} loading={busy === "unlink"}>Unlink LinkedIn</Button>
                                {!me.hasPassword && <p className="text-xs text-[var(--text-3)]">Set a password above before unlinking.</p>}
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-[var(--text-2)]">Link LinkedIn to sign in with one click.</p>
                                <LinkedInButton as="employer-link" text="Link LinkedIn" />
                            </>
                        )}
                    </div>

                    <div className="plasma-card p-5 space-y-3 border-[var(--danger)]/40">
                        <h2 className="font-semibold text-[var(--danger)]">Delete account</h2>
                        <p className="text-sm text-[var(--text-2)]">You leave all companies. Not allowed while you are the only owner of a company.</p>
                        <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete my account</Button>
                    </div>

                    <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete account?" size="sm">
                        <p className="text-sm text-[var(--text-2)] mb-4">This signs you out and disables your account.</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                            <Button variant="danger" loading={busy === "delete"} onClick={deleteAccount}>Delete</Button>
                        </div>
                    </Modal>
                </>
            )}
        </main>
    );
}
