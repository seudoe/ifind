"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { InternshipStatus } from "@/types/employer";
import type { Moderation } from "@/types/internship";

const TABS = [
    { label: "Overview", segment: "overview" },
    { label: "Internship details", segment: "internship-details" },
    { label: "Students applied", segment: "students-applied" },
    { label: "Settings", segment: "settings" },
];

const STATUS_VARIANT: Record<InternshipStatus, "secondary" | "success" | "warning" | "danger" | "outline"> = {
    draft: "secondary", published: "success", paused: "warning", closed: "danger", archived: "outline",
};
const MOD_VARIANT: Record<Moderation["status"], "success" | "warning" | "danger"> = {
    auto_approved: "success", manually_approved: "success", pending_review: "warning",
    auto_rejected: "danger", manually_rejected: "danger",
};

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
            <Link href={basePath.replace(/\/[^/]+$/, "")} className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">
                ← All internships
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[var(--text)] mr-1">{name}</h1>
                <Badge variant={STATUS_VARIANT[status]} className="capitalize">{status}</Badge>
                <Badge variant={MOD_VARIANT[moderationStatus]}>{moderationStatus.replace(/_/g, " ")}</Badge>
                <Badge variant="outline">{applicantCount} applicant{applicantCount === 1 ? "" : "s"}</Badge>
            </div>
            <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
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
