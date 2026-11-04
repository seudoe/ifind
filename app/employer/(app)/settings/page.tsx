"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Eye, EyeOff, KeyRound, Link2, Link2Off, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { hasBothMethods, linkedinReauthDueAt, linkedinState, LINKEDIN_REAUTH_DAYS, merged, type LinkedInState } from "@/lib/linkedinState";
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

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
    return (
        <div className="plasma-card p-5">
            <div className="flex items-center gap-2 mb-1 pb-3 border-b border-[var(--border)]">
                <span className="text-[var(--primary)]">{icon}</span>
                <div>
                    <h3 className="text-sm font-semibold text-[var(--heading)]">{title}</h3>
                    <p className="text-xs text-[var(--text-3)]">{desc}</p>
                </div>
            </div>
            <div className="pt-4">{children}</div>
        </div>
    );
}

const STATES: { key: LinkedInState; title: string; text: string; icon: typeof Link2Off }[] = [
    { key: "normal", title: "Normal", text: "Email and password. Nothing about you has been checked by iFind or LinkedIn.", icon: Link2Off },
    { key: "connected", title: "LinkedIn connected", text: merged ? "Your LinkedIn account is linked to your iFind account." : "Your LinkedIn account is linked, but LinkedIn has not verified your identity (government ID and selfie).", icon: Link2 },
    { key: "verified", title: "Verified on LinkedIn", text: "Your LinkedIn account is linked and LinkedIn has verified your identity (government ID and selfie). Re-checked on every LinkedIn sign-in.", icon: BadgeCheck },
];

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

function EmployerAccountStatusCard({ me }: { me: Employer }) {
    const state = linkedinState({
        linkedinId: me.linkedinId ?? (me.linkedinLinked ? "linked" : null),
        linkedinVerification: me.linkedinVerification,
        hasPassword: me.hasPassword,
        linkedinLastAuthAt: me.linkedinLastAuthAt,
        linkedinLinkedAt: me.linkedinLinkedAt,
    });
    const both = hasBothMethods({
        linkedinId: me.linkedinId ?? (me.linkedinLinked ? "linked" : null),
        hasPassword: me.hasPassword,
    });
    const due = linkedinReauthDueAt({
        linkedinId: me.linkedinId ?? (me.linkedinLinked ? "linked" : null),
        hasPassword: me.hasPassword,
        linkedinLastAuthAt: me.linkedinLastAuthAt,
        linkedinLinkedAt: me.linkedinLinkedAt,
    });

    return (
        <Card icon={<ShieldCheck className="h-4 w-4" />} title="Account status" desc="How your account is verified and how you can sign in">
            <div className={`grid gap-2 ${merged ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                {STATES.filter((s) => !merged || s.key !== "verified").map(({ key, title, text, icon: Icon }) => {
                    const on = key === state;
                    return (
                        <div key={key} className={`rounded-[var(--radius-sm)] border p-3 text-xs ${on ? "border-[var(--primary)] bg-[var(--primary-bg)]" : "border-[var(--border)] opacity-60"}`}>
                            <p className="flex items-center gap-1.5 font-semibold text-[var(--heading)]">
                                <Icon className="h-3.5 w-3.5" /> {title}
                                {on && <span className="ml-auto text-[10px] font-bold uppercase text-[var(--primary)]">You</span>}
                            </p>
                            <p className="mt-1 text-[var(--text-2)]">{text}</p>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 space-y-2 text-xs text-[var(--text-2)]">
                <p>
                    <strong className="text-[var(--text)]">Sign-in methods:</strong>{" "}
                    {[me.hasPassword && "email and password", (me.linkedinId || me.linkedinLinked) && "LinkedIn"].filter(Boolean).join(" and ") || "none"}.
                </p>
                {both && (
                    <p className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3">
                        You can sign in with your password or with LinkedIn. About every {LINKEDIN_REAUTH_DAYS} days you must sign in with LinkedIn once so we know it is still you; until then the password keeps working
                        {due ? <> (next LinkedIn sign-in due by <strong className="text-[var(--text)]">{fmt(due)}</strong>)</> : null}. After that date the password stops working until you sign in with LinkedIn.
                    </p>
                )}
                {!me.linkedinLinked && !me.linkedinId && (
                    <a href="/api/auth/linkedin?as=employer-link" className="inline-block font-medium text-[var(--primary)] hover:underline">
                        Connect LinkedIn
                    </a>
                )}
            </div>
        </Card>
    );
}

export default function SettingsPage() {
    const router = useRouter();
    const [me, setMe] = useState<Employer | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [again, setAgain] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [ready, setReady] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pw") === "ready");

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
        if (q.get("pw") === "ready") setReady(true);
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
        if (next !== again) {
            toast.error("The two new passwords do not match");
            return;
        }
        run("pw", async () => {
            const res = await fetch("/api/employer/account/password", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (j.code === "linkedin_reauth_required") setReady(false);
                throw new Error(j.error || "Could not update the password");
            }
            toast.success(me?.hasPassword ? "Password updated" : "Password set. You can now sign in with it too.");
            setCurrent("");
            setNext("");
            setAgain("");
            setReady(false);
            window.history.replaceState(null, "", window.location.pathname);
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

    const eye = (shown: boolean, toggle: () => void) => (
        <button type="button" onClick={toggle} className="text-[var(--text-3)] hover:text-[var(--text)]">
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
    );

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-2xl space-y-6">
            <h1 className="text-lg font-bold text-[var(--heading)]">Settings</h1>
            {loadError ? (
                <p className="text-sm text-[var(--danger)]">{loadError}</p>
            ) : !me ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
            ) : (
                <>
                    <EmployerAccountStatusCard me={me} />

                    {/* Password Management */}
                    {!me.hasPassword && !ready ? (
                        <Card icon={<Lock className="h-4 w-4" />} title="Password" desc="You signed up with LinkedIn">
                            <p className="text-sm text-[var(--text-2)]">You registered through LinkedIn, so your account has no password yet. You can add one to sign in with email and password as well.</p>
                            <p className="mt-2 text-xs text-[var(--text-3)]">To make sure it is really you, LinkedIn will ask you to sign in again before you can set it.</p>
                            <a href="/api/auth/linkedin?as=employer-setpw" className="mt-4 inline-flex">
                                <Button size="sm" type="button"><KeyRound className="h-3.5 w-3.5" /> Set password</Button>
                            </a>
                        </Card>
                    ) : (
                        <form onSubmit={savePassword} className="plasma-card p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-1 pb-3 border-b border-[var(--border)]">
                                <span className="text-[var(--primary)]"><Lock className="h-4 w-4" /></span>
                                <div>
                                    <h2 className="text-sm font-semibold text-[var(--heading)]">{me.hasPassword ? "Change Password" : "Set Password"}</h2>
                                    <p className="text-xs text-[var(--text-3)]">{me.hasPassword ? "Choose a strong password you don't use elsewhere" : "LinkedIn confirmed. Choose a strong password you don't use elsewhere"}</p>
                                </div>
                            </div>
                            {me.hasPassword && (
                                <Input
                                    label="Current Password"
                                    type={showCurrent ? "text" : "password"}
                                    value={current}
                                    onChange={(e) => setCurrent(e.target.value)}
                                    placeholder="Your current password"
                                    autoComplete="current-password"
                                    required
                                    rightIcon={eye(showCurrent, () => setShowCurrent(!showCurrent))}
                                />
                            )}
                            <Input
                                label="New Password"
                                type={showNew ? "text" : "password"}
                                value={next}
                                onChange={(e) => setNext(e.target.value)}
                                placeholder="Min 8 chars, 1 uppercase, 1 number"
                                hint="Min 8 characters, 1 uppercase, 1 number"
                                autoComplete="new-password"
                                required
                                rightIcon={eye(showNew, () => setShowNew(!showNew))}
                            />
                            <Input
                                label="Confirm New Password"
                                type="password"
                                value={again}
                                onChange={(e) => setAgain(e.target.value)}
                                placeholder="Repeat new password"
                                autoComplete="new-password"
                                required
                            />
                            <Button type="submit" loading={busy === "pw"} disabled={!next || (me.hasPassword && !current)}>
                                {me.hasPassword ? "Update Password" : "Set Password"}
                            </Button>
                            {me.linkedinLinked && me.hasPassword && (
                                <p className="text-xs text-[var(--text-3)]">You can sign in with this password or with LinkedIn. Other devices are signed out when it changes.</p>
                            )}
                        </form>
                    )}

                    <div className="plasma-card p-5 space-y-3">
                        <h2 className="font-semibold text-[var(--heading)]">LinkedIn</h2>
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