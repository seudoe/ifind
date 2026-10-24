"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ModerationPill, StatusPill } from "@/components/employer/Pills";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { InternshipStatus } from "@/types/employer";
import type { Moderation } from "@/types/internship";

const TABS = [
    { label: "Applicants", segment: "applicants" },
    { label: "Internship details", segment: "internship-details" },
    { label: "Overview", segment: "overview" },
    { label: "Settings", segment: "settings" },
];

interface Props {
    basePath: string;
    name: string;
    status: InternshipStatus;
    moderationStatus: Moderation["status"];
    applicantCount: number;
}

export function InternshipTabs({ basePath, name, status, moderationStatus, applicantCount }: Props) {
    const pathname = usePathname();
    return (
        <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
                {/* Replaces the All / Draft / Published... tabs of the list with the sub-tabs below */}
                <Link
                    href={basePath.replace(/\/[^/]+$/, "")}
                    className="mr-1 inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                    <ChevronLeft className="h-3.5 w-3.5" /> Back
                </Link>
                <h1 className="text-lg font-bold text-[var(--heading)] mr-1">{name}</h1>
                <StatusPill status={status} />
                {status !== "draft" && <ModerationPill status={moderationStatus} />}
                <Badge variant="outline">{applicantCount} applicant{applicantCount === 1 ? "" : "s"}</Badge>
            </div>
            <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
                {TABS.map((t) => {
                    const href = `${basePath}/${t.segment}`;
                    const active = pathname === href;
                    return (
                        <Link
                            key={t.segment}
                            href={href}
                            className={cn(
                                "whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                                active
                                    ? "border-[var(--primary)] text-[var(--primary)]"
                                    : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                            )}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
