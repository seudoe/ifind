"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, GraduationCap } from "lucide-react";
import { VerificationBadge } from "@/components/employer/VerificationBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/types/employer";

export interface InstituteView {
    kind: "company" | "college";
    _id: string;
    name: string;
    logo: string | null;
    role: string;
    status: string;
    openInternships: number;
    newApplicants: number;
    studentsJoined?: number;
    members?: number;
    collegeName?: string | null;
}

const FILTERS = [
    { key: "all", label: "All" },
    { key: "company", label: "Companies" },
    { key: "college", label: "Colleges" },
] as const;

export function InstitutesList({ rows }: { rows: InstituteView[] }) {
    const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
    const shown = rows.filter((r) => filter === "all" || r.kind === filter);

    if (rows.length === 0) {
        return (
            <div className="plasma-card p-10 text-center">
                <Building2 className="mx-auto h-10 w-10 text-[var(--text-3)] mb-3" />
                <p className="font-medium text-[var(--text)]">Nothing here yet</p>
                <p className="text-sm text-[var(--text-3)] mb-4">Register a company to post internships, or set up your college campus for on-campus drives.</p>
                <Link href="/employer/institutes/new"><Button>Get started</Button></Link>
            </div>
        );
    }

    return (
        <>
            <div className="mb-4 flex gap-1.5" role="tablist" aria-label="Filter institutes">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        role="tab"
                        aria-selected={filter === f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            filter === f.key ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {shown.length === 0 ? (
                <p className="plasma-card p-6 text-sm text-[var(--text-3)]">No {filter === "college" ? "college campuses" : "companies"} yet.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((r) => <InstituteCard key={`${r.kind}:${r._id}`} r={r} />)}
                </div>
            )}
        </>
    );
}

function InstituteCard({ r }: { r: InstituteView }) {
    const college = r.kind === "college";
    const href = college ? `/employer/campus/${r._id}/overview` : `/employer/company/${r._id}/overview`;
    const Icon = college ? GraduationCap : Building2;
    const accent = college ? "var(--campus)" : "var(--primary)";
    return (
        <Link
            href={href}
            className={cn("plasma-card p-4 block hover:shadow-[var(--shadow)] transition-shadow", college && "border-l-4 border-l-[var(--campus)]")}
        >
            <div className="flex items-start gap-3">
                {r.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo} alt={r.name} className="h-11 w-11 rounded-[var(--radius-sm)] object-cover shrink-0" />
                ) : (
                    <div className="h-11 w-11 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0" style={{ background: college ? "var(--campus-bg)" : "var(--primary-bg)" }}>
                        <Icon className="h-5 w-5" style={{ color: accent }} />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--text)]">{r.name}</p>
                    {college && r.collegeName && <p className="truncate text-xs text-[var(--text-3)]">{r.collegeName}</p>}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {college ? (
                            <span className="inline-flex items-center rounded-[var(--radius-xl)] bg-[var(--campus-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--campus)]">College</span>
                        ) : (
                            <VerificationBadge status={(r.status as VerificationStatus) ?? "unverified"} />
                        )}
                        {college && r.status !== "none" && <Badge variant="danger" className="capitalize">{r.status}</Badge>}
                        <Badge variant="outline" className="capitalize">{r.role}</Badge>
                    </div>
                </div>
            </div>
            <div className={cn("mt-4 grid gap-2 text-center", college ? "grid-cols-3" : "grid-cols-2")}>
                <Stat value={r.openInternships} label={college ? "Open" : "Published"} />
                {college && <Stat value={r.studentsJoined ?? 0} label="Students" />}
                <Stat value={r.newApplicants} label="New applicants" highlight={r.newApplicants > 0} accent={accent} />
            </div>
        </Link>
    );
}

function Stat({ value, label, highlight, accent }: { value: number; label: string; highlight?: boolean; accent?: string }) {
    return (
        <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] py-2">
            <p className="text-lg font-bold text-[var(--text)]" style={highlight ? { color: accent } : undefined}>{value}</p>
            <p className="text-[11px] text-[var(--text-3)]">{label}</p>
        </div>
    );
}
