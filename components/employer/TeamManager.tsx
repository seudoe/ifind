"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { MEMBER_ROLES, ROLE_RANK, type MemberRole } from "@/types/employer";

interface Member { employerId: string; role: MemberRole; name: string; email: string; profilePicture?: string | null }

const selectCls = "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm capitalize";

export function TeamManager({ companyId }: { companyId: string }) {
    const url = `/api/employer/companies/${companyId}/members`;
    const [members, setMembers] = useState<Member[] | null>(null);
    const [myRole, setMyRole] = useState<MemberRole>("recruiter");
    const [myId, setMyId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<MemberRole>("recruiter");
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        fetch(url, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => {
                if (!j.success) return setError(j.error);
                setMembers(j.data);
                setMyRole(j.myRole);
                setMyId(j.myId);
            })
            .catch(() => setError("Unable to load team"));
    }, [url]);
    useEffect(load, [load]);

    const call = async (fn: () => Promise<Response>, ok: string) => {
        setBusy(true);
        try {
            const j = await (await fn()).json();
            if (!j.success) throw new Error(j.error);
            toast.success(ok);
            load();
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Request failed");
            return false;
        } finally {
            setBusy(false);
        }
    };
    const req = (method: string, body?: unknown, qs = "") =>
        fetch(url + qs, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

    const canManage = ROLE_RANK[myRole] >= ROLE_RANK.admin;
    const isOwner = myRole === "owner";
    const assignable = MEMBER_ROLES.filter((r) => isOwner || r !== "owner");

    const add = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (await call(() => req("POST", { email, role }), "Member added")) setEmail("");
    };

    return (
        <div className="max-w-3xl space-y-6">
            <h1 className="text-lg font-bold text-[var(--text)]">Team</h1>

            {canManage && (
                <form onSubmit={add} className="plasma-card p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1"><Input label="Add by email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required hint="They need an iFind employer account" /></div>
                    <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value as MemberRole)} aria-label="Role">
                        {assignable.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Button type="submit" loading={busy}>Add</Button>
                </form>
            )}

            {error ? (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : !members ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (
                <ul className="space-y-2">
                    {members.map((m) => {
                        const self = m.employerId === myId;
                        // Admins can't touch owners; only owners can
                        const editable = canManage && (m.role !== "owner" || isOwner);
                        return (
                            <li key={m.employerId} className="plasma-card p-3 flex items-center gap-3">
                                <Avatar src={m.profilePicture} name={m.name} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-[var(--text)]">{m.name}{self && " (you)"}</p>
                                    <p className="truncate text-xs text-[var(--text-3)]">{m.email}</p>
                                </div>
                                {editable ? (
                                    <select
                                        className={selectCls}
                                        value={m.role}
                                        disabled={busy}
                                        aria-label={`Role for ${m.name}`}
                                        onChange={(e) => call(() => req("PATCH", { employerId: m.employerId, role: e.target.value }), "Role updated")}
                                    >
                                        {assignable.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                ) : (
                                    <span className="text-sm capitalize text-[var(--text-2)]">{m.role}</span>
                                )}
                                {(editable || self) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => call(() => req("DELETE", undefined, `?employerId=${m.employerId}`), self ? "You left the company" : "Member removed")}
                                    >
                                        {self ? "Leave" : "Remove"}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
