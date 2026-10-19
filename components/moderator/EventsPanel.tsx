"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TYPE_LABELS, closingLabel, eventDates, type ModeratorEventItem } from "@/lib/events";

async function fetchEvents(): Promise<ModeratorEventItem[]> {
    const res = await fetch("/api/moderator/events", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load events");
    return (await res.json()).data.items;
}

function Status({ event }: { event: ModeratorEventItem }) {
    if (event.hidden) return <Badge variant="warning">Hidden</Badge>;
    if (event.expired) return <Badge variant="secondary">Expired</Badge>;
    return <Badge variant="success">Live</Badge>;
}

export function EventsPanel() {
    const [items, setItems] = useState<ModeratorEventItem[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<string | null>(null);

    const load = useCallback(() => fetchEvents().then(setItems).catch(() => toast.error("Failed to load events")), []);

    useEffect(() => {
        fetchEvents().then(setItems).catch(() => toast.error("Failed to load events"));
    }, []);

    const act = async (id: string, request: () => Promise<Response>, done: string) => {
        setBusy(id);
        try {
            const res = await request();
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error ?? "Request failed");
            toast.success(done);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Request failed");
        } finally {
            setBusy(null);
            setConfirming(null);
        }
    };

    const setHidden = (e: ModeratorEventItem) =>
        act(
            e.id,
            () =>
                fetch(`/api/moderator/events/${e.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: e.hidden ? "unhide" : "hide" }),
                }),
            e.hidden ? "Event is visible again" : "Event hidden from students",
        );

    const remove = (e: ModeratorEventItem) =>
        act(e.id, () => fetch(`/api/moderator/events/${e.id}`, { method: "DELETE", credentials: "include" }), "Event deleted");

    if (!items) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <p className="plasma-card p-10 text-center text-sm text-[var(--text-3)]">
                No events yet. Send the Telegram bot a message starting with EVENT and a registration link.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs text-[var(--text-3)]">
                Events go live as soon as the bot saves them. Hide one to take it off the student page; expired events are removed automatically a few weeks after they close.
            </p>
            {items.map((e) => (
                <div key={e.id} className="plasma-card flex flex-wrap items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <Status event={e} />
                            <Badge variant="default">{TYPE_LABELS[e.type]}</Badge>
                            {e.hiring && <Badge variant="success">Hiring</Badge>}
                            {!e.expired && <Badge variant="outline">{closingLabel(e).text}</Badge>}
                        </div>
                        <p className="text-sm font-medium text-[var(--text)]">{e.title}</p>
                        <p className="text-xs text-[var(--text-2)]">
                            {[e.organiser, eventDates(e)].filter(Boolean).join(" · ") || "No dates found"}
                        </p>
                        <a
                            href={e.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--primary)] hover:underline"
                        >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{e.link}</span>
                        </a>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="secondary" loading={busy === e.id} onClick={() => setHidden(e)} className="gap-1.5">
                            {e.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {e.hidden ? "Unhide" : "Hide"}
                        </Button>
                        {confirming === e.id ? (
                            <Button size="sm" variant="danger" loading={busy === e.id} onClick={() => remove(e)}>
                                Confirm delete
                            </Button>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => setConfirming(e.id)} aria-label="Delete event">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
