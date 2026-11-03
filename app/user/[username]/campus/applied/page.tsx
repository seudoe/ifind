"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Send } from "lucide-react";
import { CampusApplicationPill } from "@/components/campus/CampusApplicationPill";
import { useCampus } from "@/components/student/campus/CampusProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CampusAppliedItem } from "@/lib/campus/studentApplications";

/** Campus applications with their status. They stay here even after leaving a campus. */
export default function CampusAppliedPage() {
    const { state } = useCampus();
    const { username } = useParams<{ username: string }>();
    const [items, setItems] = useState<CampusAppliedItem[] | null>(null);

    useEffect(() => {
        let live = true;
        fetch("/api/user/campus/applications", { credentials: "include" }).then((r) => r.json())
            .then((j) => live && setItems(j.success ? j.data.items : []))
            .catch(() => live && setItems([]));
        return () => { live = false; };
    }, []);

    if (!state || !items) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
    if (!items.length) {
        return (
            <div className="plasma-card p-10 text-center max-w-md mx-auto">
                <Send className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
                <p className="text-sm font-medium text-[var(--text)]">No campus applications yet</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">{state.current ? "Internships you apply to through your campus show up here with their status." : "Join your college's campus to apply to its internships."}</p>
            </div>
        );
    }
    return (
        <ul className="space-y-2">
            {items.map((a) => (
                <li key={a.applicationId}>
                    <Link href={`/user/${username}/campus/applied/${a.applicationId}`} className="plasma-card flex items-center gap-3 p-4 hover:shadow-[var(--shadow-lg)] transition-shadow">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">{a.company}</p>
                            <p className="truncate text-xs text-[var(--text-2)]">{a.designation} · Applied {new Date(a.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                            {a.acceptBy && <p className="text-xs font-medium text-[var(--warning)]">Answer the offer by {new Date(a.acceptBy).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>}
                        </div>
                        <CampusApplicationPill status={a.status} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
