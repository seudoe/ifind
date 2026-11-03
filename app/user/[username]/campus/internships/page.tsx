"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Briefcase, CircleCheck, CircleX } from "lucide-react";
import { ApplyDialog } from "@/components/student/campus/ApplyDialog";
import { Button } from "@/components/ui/Button";
import { useCampus } from "@/components/student/campus/CampusProvider";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface Item {
    _id: string;
    company: { name: string; tier?: string | null; logo?: string | null };
    designation: string;
    description: string;
    deadlineDate: string | null;
    interviewDate: string | null;
    duration: { value: number; unit: string } | null;
    stipend: { type: string; amount?: number | null; period?: string | null } | null;
    workMode: string;
    locations: string[];
    eligible: boolean;
    reasons: string[];
    applicationStatus: string | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);
const TBA = "To be announced";

export default function CampusInternshipsPage() {
    const { state } = useCampus();
    const { username } = useParams<{ username: string }>();
    const [items, setItems] = useState<Item[] | null>(null);
    const [applying, setApplying] = useState<string | null>(null);
    const [tick, setTick] = useState(0);
    const joined = !!state?.current;

    useEffect(() => {
        if (!joined) return;
        let live = true;
        fetch("/api/user/campus/internships", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => live && setItems(j.success ? j.data.items : []))
            .catch(() => live && setItems([]));
        return () => { live = false; };
    }, [joined, tick]);

    if (!state) return null;
    if (!joined) {
        return (
            <div className="plasma-card p-10 text-center max-w-md mx-auto">
                <Briefcase className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
                <p className="text-sm font-medium text-[var(--text)]">Internships from your campus show up here</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">Join your college&apos;s campus to see them.</p>
            </div>
        );
    }
    if (!items) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
    if (!items.length) {
        return (
            <div className="plasma-card p-10 text-center max-w-md mx-auto">
                <Briefcase className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
                <p className="text-sm font-medium text-[var(--text)]">No open internships right now</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">{state.current?.name} hasn&apos;t posted any open internships yet.</p>
            </div>
        );
    }

    return (
        <ul className="space-y-3">
            {items.map((i) => (
                <li key={i._id} className={`plasma-card p-4 space-y-2 ${i.applicationStatus ? "border-l-4 border-l-[var(--campus)]" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p className="font-semibold text-[var(--text)]">{i.company.name}{i.company.tier && <Badge variant="outline" className="ml-2 capitalize">{i.company.tier.replace("_", " ")}</Badge>}</p>
                            <p className="text-sm text-[var(--text-2)]">{i.designation}</p>
                        </div>
                        {i.applicationStatus ? <Badge variant="success" className="capitalize">You applied · {i.applicationStatus.replace("_", " ")}</Badge> : i.eligible ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--mint-ink)]"><CircleCheck className="h-3.5 w-3.5" /> You&apos;re eligible</span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-3)]"><CircleX className="h-3.5 w-3.5" /> Not eligible</span>
                        )}
                    </div>
                    {!i.eligible && !i.applicationStatus && (
                        <ul className="list-disc pl-5 text-xs text-[var(--text-2)]">{i.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    )}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                        <div><dt className="text-[var(--text-3)]">Apply by</dt><dd className="text-[var(--text)]">{when(i.deadlineDate) ?? TBA}</dd></div>
                        <div><dt className="text-[var(--text-3)]">Interviews</dt><dd className="text-[var(--text)]">{when(i.interviewDate) ?? TBA}</dd></div>
                        <div><dt className="text-[var(--text-3)]">Stipend</dt><dd className="text-[var(--text)] capitalize">{i.stipend ? (i.stipend.type === "paid" && i.stipend.amount ? `₹${i.stipend.amount.toLocaleString("en-IN")}${i.stipend.period === "monthly" ? "/month" : ""}` : i.stipend.type) : TBA}</dd></div>
                        <div><dt className="text-[var(--text-3)]">Duration</dt><dd className="text-[var(--text)]">{i.duration ? `${i.duration.value} ${i.duration.unit}` : TBA}</dd></div>
                    </dl>
                    <div className="flex justify-end">
                        {i.applicationStatus ? (
                            <Link href={`/user/${username}/campus/applied`} className="text-sm text-[var(--primary)] hover:underline">View application</Link>
                        ) : (
                            <Button size="sm" disabled={!i.eligible} onClick={() => setApplying(i._id)}>{i.eligible ? "Apply" : "Not eligible"}</Button>
                        )}
                    </div>
                </li>
            ))}
            {applying && state?.enrollment && <ApplyDialog internshipId={applying} enrollment={state.enrollment} onClose={() => setApplying(null)} onDone={() => { setApplying(null); setItems(null); setTick((t) => t + 1); }} />}
        </ul>
    );
}
