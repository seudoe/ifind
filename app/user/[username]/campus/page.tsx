"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CalendarPlus, ExternalLink, MapPin } from "lucide-react";
import { useCampus } from "@/components/student/campus/CampusProvider";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { countdown, dayBucket } from "@/lib/campus/datetime";
import { safeHref } from "@/lib/safeUrl";
import type { FeedItem } from "@/lib/campus/events";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);
const TYPE: Record<string, string> = {
    announcement: "Announcement", instruction: "Instruction", form: "Form", pre_placement_talk: "Pre-placement talk", online_assessment: "Online assessment",
    group_discussion: "Group discussion", technical_interview: "Technical interview", hr_interview: "HR interview", result: "Result", offer: "Offer", deadline: "Deadline", other: "Update",
};

function Card({ e }: { e: FeedItem }) {
    const cancelled = e.status === "cancelled";
    const dated = e.startsAt ?? e.deadlineAt;
    // Colour rules: events of an internship you applied to stand out; "open to you" is neutral; ineligible ones are muted
    const cls = e.tag === "applied" ? "border-l-4 border-l-[var(--campus)] bg-[var(--campus-bg)]/40" : e.tag === "muted" ? "opacity-60" : "";
    return (
        <li className={`plasma-card p-4 space-y-1.5 ${cls}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className={`font-semibold text-[var(--text)] ${cancelled ? "line-through" : ""}`}>{e.title}</p>
                    {e.internship && <p className="text-xs text-[var(--text-2)]">{e.internship.company} · {e.internship.designation}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{TYPE[e.type] ?? "Update"}</Badge>
                    {e.tag === "applied" && <Badge variant="success">You applied</Badge>}
                    {e.tag === "open" && <Badge variant="default">Open to you</Badge>}
                    {e.tag === "muted" && <Badge variant="secondary">Not eligible</Badge>}
                    {cancelled && <Badge variant="danger">Cancelled</Badge>}
                </div>
            </div>
            {dated && !cancelled && (
                <p className="text-sm text-[var(--text)]">
                    {e.startsAt ? when(e.startsAt) : `Due ${when(e.deadlineAt)}`} <span className="text-xs text-[var(--text-3)]">({countdown(dated)})</span>
                </p>
            )}
            {(e.venue || e.mode) && !cancelled && <p className="flex items-center gap-1 text-xs text-[var(--text-2)]"><MapPin className="h-3.5 w-3.5" />{e.venue ? `${e.venue} · ` : ""}<span className="capitalize">{e.mode}</span></p>}
            {e.body && <p className="whitespace-pre-line text-sm text-[var(--text-2)]">{e.body}</p>}
            {!cancelled && (
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                    {e.link && <a href={safeHref(e.link)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Open link</a>}
                    {dated && <a href={`/api/user/campus/events/${e._id}/ics`} download className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"><CalendarPlus className="h-3.5 w-3.5" /> Add to calendar</a>}
                </div>
            )}
        </li>
    );
}

/** Home: the campus feed. Today, tomorrow, upcoming; past events are tucked away. */
export default function CampusHomePage() {
    const { state } = useCampus();
    const [items, setItems] = useState<FeedItem[] | null>(null);
    const joined = !!state?.current;

    useEffect(() => {
        if (!joined) return;
        let live = true;
        fetch("/api/user/campus/home", { credentials: "include" }).then((r) => r.json())
            .then((j) => live && setItems(j.success ? j.data.items : []))
            .catch(() => live && setItems([]));
        return () => { live = false; };
    }, [joined]);

    if (!state) return null;
    if (!joined) {
        return (
            <div className="plasma-card p-10 text-center max-w-md mx-auto">
                <CalendarDays className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
                <p className="text-sm font-medium text-[var(--text)]">Updates from your campus show up here</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">Join your college&apos;s campus to see its announcements and schedules.</p>
            </div>
        );
    }
    if (!items) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
    if (!items.length) {
        return (
            <div className="plasma-card p-10 text-center max-w-md mx-auto">
                <CalendarDays className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
                <p className="text-sm font-medium text-[var(--text)]">No updates from {state.current?.name} yet</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">Announcements, tests and interview schedules will appear here.</p>
            </div>
        );
    }

    const groups = { today: [] as FeedItem[], tomorrow: [] as FeedItem[], upcoming: [] as FeedItem[], earlier: [] as FeedItem[] };
    for (const e of items) groups[dayBucket(e.at)].push(e);
    const section = (title: string, list: FeedItem[]) => list.length > 0 && (
        <section key={title} className="space-y-2"><h2 className="label">{title}</h2><ul className="space-y-2">{list.map((e) => <Card key={e._id} e={e} />)}</ul></section>
    );
    return (
        <div className="space-y-6">
            {section("Today", groups.today)}
            {section("Tomorrow", groups.tomorrow)}
            {section("Upcoming", groups.upcoming)}
            {groups.earlier.length > 0 && (
                <details className="group">
                    <summary className="label cursor-pointer select-none">Earlier ({groups.earlier.length})</summary>
                    <ul className="mt-2 space-y-2">{[...groups.earlier].reverse().map((e) => <Card key={e._id} e={e} />)}</ul>
                </details>
            )}
        </div>
    );
}
