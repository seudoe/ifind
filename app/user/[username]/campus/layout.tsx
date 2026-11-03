"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { CampusBanner } from "@/components/student/campus/CampusBanner";
import { CampusProvider, useCampus } from "@/components/student/campus/CampusProvider";
import { CollegeDetailsForm } from "@/components/student/campus/CollegeDetailsForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

const TABS = [
    { label: "Home", segment: "" },
    { label: "Campuses", segment: "campuses" },
    { label: "Internships", segment: "internships" },
    { label: "Applied", segment: "applied" },
    { label: "College details", segment: "details" },
];

function Area({ children }: { children: React.ReactNode }) {
    const { state, error, refresh } = useCampus();
    const { username } = useParams<{ username: string }>();
    const pathname = usePathname();
    const base = `/user/${username}/campus`;

    if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
    if (!state) return <div className="space-y-3 max-w-3xl"><Skeleton className="h-10" /><Skeleton className="h-40" /></div>;

    // No details yet: the first thing to do is tell us your college
    if (!state.enrollment) {
        return (
            <div className="max-w-2xl space-y-5">
                <div className="plasma-card p-5 border-l-4 border-l-[var(--campus)]">
                    <h2 className="flex items-center gap-2 font-semibold text-[var(--heading)]"><GraduationCap className="h-5 w-5 text-[var(--campus)]" /> Campus internships</h2>
                    <p className="mt-1 text-sm text-[var(--text-2)]">Your college&apos;s placement team can post internships and events just for its students. Tell us your college to get started. You can fill everything in now, even if your college hasn&apos;t set up iFind yet.</p>
                </div>
                <CollegeDetailsForm onSaved={refresh} />
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Campus sections">
                {TABS.map((t) => {
                    const href = t.segment ? `${base}/${t.segment}` : base;
                    const active = t.segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
                    return (
                        <Link
                            key={t.label}
                            href={href}
                            className={cn("whitespace-nowrap border-b-2 -mb-px px-3 py-2 text-sm font-medium transition-colors", active ? "border-[var(--campus)] text-[var(--campus)]" : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]")}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>
            <CampusBanner banner={state.banner} />
            {children}
        </div>
    );
}

export default function CampusLayout({ children }: { children: React.ReactNode }) {
    return (
        <CampusProvider>
            <Area>{children}</Area>
        </CampusProvider>
    );
}
