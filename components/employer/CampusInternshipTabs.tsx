"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CampusStatusPill } from "@/components/employer/CampusInternshipsTable";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { CampusInternshipStatus } from "@/types/campus";

/** The events tab arrives with the events feature. */
const TABS = [
    { label: "Applicants", segment: "applicants" },
    { label: "Details", segment: "details" },
    { label: "Settings", segment: "settings" },
];

interface Props {
    basePath: string;
    company: string;
    designation: string;
    status: CampusInternshipStatus;
    applicantCount: number;
}

export function CampusInternshipTabs({ basePath, company, designation, status, applicantCount }: Props) {
    const pathname = usePathname();
    return (
        <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href={basePath.replace(/\/[^/]+$/, "")}
                    className="mr-1 inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                    <ChevronLeft className="h-3.5 w-3.5" /> Back
                </Link>
                <h1 className="text-lg font-bold text-[var(--heading)] mr-1">{company}<span className="font-normal text-[var(--text-2)]"> · {designation}</span></h1>
                <CampusStatusPill status={status} />
                <Badge variant="outline">{applicantCount} applicant{applicantCount === 1 ? "" : "s"}</Badge>
            </div>
            <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
                {TABS.map((t) => {
                    const href = `${basePath}/${t.segment}`;
                    return (
                        <Link
                            key={t.segment}
                            href={href}
                            className={cn("whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors", pathname === href ? "border-[var(--campus)] text-[var(--campus)]" : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]")}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
