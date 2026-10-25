"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/employer";

/** Inbox list for any audience: GET {endpoint} -> { items }, PATCH {endpoint} with { id } or { all: true }. */
export function NotificationInbox({ endpoint, onChange }: { endpoint: string; onChange?: () => void }) {
    const [items, setItems] = useState<AppNotification[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        fetch(endpoint, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => (j.success ? setItems(j.data.items) : setError(j.error)))
            .catch(() => setError("Unable to load notifications"));
    }, [endpoint]);
    useEffect(load, [load]);

    const mark = async (body: { id: string } | { all: true }) => {
        await fetch(endpoint, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        load();
        onChange?.();
    };

    const hasUnread = items?.some((n) => !n.readAt);

    return (
        <div className="max-w-2xl">
            <div className="flex justify-end mb-4 min-h-8">
                {hasUnread && (
                    <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => mark({ all: true })}>
                        <CheckCheck className="h-4 w-4" /> Mark all read
                    </Button>
                )}
            </div>

            {error ? (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : !items ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : items.length === 0 ? (
                <div className="plasma-card p-10 text-center">
                    <Bell className="mx-auto h-9 w-9 text-[var(--text-3)] mb-2" />
                    <p className="text-sm text-[var(--text-3)]">You&apos;re all caught up.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {items.map((n) => {
                        const content = (
                            <>
                                {n.priority === "critical" && <span className="pill !cursor-default !border-[var(--warning)] !text-[var(--warning)] mb-1">Important · emailed</span>}
                                <p className="text-sm font-medium text-[var(--text)]">{n.title}</p>
                                {n.body && <p className="text-xs text-[var(--text-2)] mt-0.5">{n.body}</p>}
                                <p className="text-[11px] text-[var(--text-3)] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                            </>
                        );
                        return (
                            <li key={n._id} className={cn("plasma-card p-3 flex items-start gap-3", !n.readAt && "border-l-4 border-l-[var(--primary)]")}>
                                <div className="min-w-0 flex-1">
                                    {n.link ? <Link href={n.link} onClick={() => !n.readAt && mark({ id: n._id })}>{content}</Link> : content}
                                </div>
                                {!n.readAt && (
                                    <button onClick={() => mark({ id: n._id })} className="text-xs text-[var(--primary)] hover:underline shrink-0">Mark read</button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
