"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/employer";

export default function NotificationsPage() {
    const router = useRouter();
    const [items, setItems] = useState<AppNotification[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        fetch("/api/employer/notifications", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => (j.success ? setItems(j.data.items) : setError(j.error)))
            .catch(() => setError("Unable to load notifications"));
    }, []);
    useEffect(load, [load]);

    const mark = async (body: { id: string } | { all: true }) => {
        await fetch("/api/employer/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        load();
        router.refresh();
    };

    const hasUnread = items?.some((n) => !n.readAt);

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-bold text-[var(--text)]">Notifications</h1>
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
                        const body = (
                            <>
                                <p className="text-sm font-medium text-[var(--text)]">{n.title}</p>
                                {n.body && <p className="text-xs text-[var(--text-2)] mt-0.5">{n.body}</p>}
                                <p className="text-[11px] text-[var(--text-3)] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                            </>
                        );
                        return (
                            <li key={n._id} className={cn("plasma-card p-3 flex items-start gap-3", !n.readAt && "border-l-4 border-l-[var(--primary)]")}>
                                <div className="min-w-0 flex-1">
                                    {n.link ? (
                                        <Link href={n.link} onClick={() => !n.readAt && mark({ id: n._id })}>{body}</Link>
                                    ) : body}
                                </div>
                                {!n.readAt && (
                                    <button onClick={() => mark({ id: n._id })} className="text-xs text-[var(--primary)] hover:underline shrink-0">
                                        Mark read
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
