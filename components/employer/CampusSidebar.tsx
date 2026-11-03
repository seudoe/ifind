"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, GraduationCap, LayoutDashboard, PlusCircle, Settings, UserRound, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { CAMPUS_ROLE_RANK, type CampusRole } from "@/types/campus";

/** Tabs are added here as their stages land (internships, events, students, team). */
const TABS: { label: string; segment: string; icon: LucideIcon; minRole: CampusRole }[] = [
    { label: "Overview", segment: "overview", icon: LayoutDashboard, minRole: "viewer" },
    { label: "Internships", segment: "internships", icon: Briefcase, minRole: "viewer" },
    { label: "Post New Internship", segment: "post-new-internship", icon: PlusCircle, minRole: "coordinator" },
    { label: "Events", segment: "events", icon: CalendarDays, minRole: "viewer" },
    { label: "Students", segment: "students", icon: UserRound, minRole: "viewer" },
    { label: "Team", segment: "team", icon: Users, minRole: "viewer" }, // everyone sees the team; managing needs admin
    { label: "Settings", segment: "settings", icon: Settings, minRole: "viewer" },
];

interface Props {
    entityId: string;
    name: string;
    logo?: string | null;
    collegeName?: string | null;
    role: CampusRole;
}

export function CampusSidebar({ entityId, name, logo, collegeName, role }: Props) {
    const pathname = usePathname();
    const base = `/employer/campus/${entityId}`;
    const tabs = TABS.filter((t) => CAMPUS_ROLE_RANK[role] >= CAMPUS_ROLE_RANK[t.minRole]);
    const isActive = (segment: string) => pathname === `${base}/${segment}` || pathname.startsWith(`${base}/${segment}/`);

    return (
        <>
            {/* Desktop */}
            <aside className="hidden md:flex sticky top-0 h-screen self-start overflow-y-auto w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] py-5">
                <div className="px-3 pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                        {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt={name} className="h-9 w-9 rounded-[var(--radius-sm)] object-cover shrink-0" />
                        ) : (
                            <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--campus-bg)] flex items-center justify-center shrink-0">
                                <GraduationCap className="h-4 w-4 text-[var(--campus)]" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">{name}</p>
                            <span className="inline-flex items-center rounded-[var(--radius-xl)] bg-[var(--campus-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--campus)]">College</span>
                        </div>
                    </div>
                    {collegeName && <p className="mt-2 truncate text-xs text-[var(--text-3)]" title={collegeName}>{collegeName}</p>}
                    <Link href="/employer/institutes" className="mt-3 block rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]">
                        All institutes
                    </Link>
                </div>
                <nav className="flex flex-col gap-1 px-3 pt-3">
                    {tabs.map(({ label, segment, icon: Icon }) => (
                        <Link
                            key={segment}
                            href={`${base}/${segment}`}
                            className={cn(
                                "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] transition-colors",
                                isActive(segment) ? "bg-[var(--campus)] text-white font-semibold" : "font-medium text-[var(--text)] hover:bg-[var(--campus-bg)] hover:text-[var(--heading)]",
                            )}
                        >
                            <Icon size={18} className="shrink-0" />
                            {label}
                        </Link>
                    ))}
                </nav>
                <p className="mt-auto px-6 pt-4"><Badge variant="outline" className="capitalize">{role}</Badge></p>
            </aside>

            {/* Mobile: scrollable tab strip */}
            <nav className="md:hidden sticky top-14 z-20 flex items-stretch overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]" aria-label="Campus sections">
                <Link href="/employer/institutes" className="flex items-center gap-2 border-r border-[var(--border)] px-3 max-w-[40%] shrink-0" title="All institutes">
                    <GraduationCap className="h-4 w-4 shrink-0 text-[var(--campus)]" />
                    <span className="truncate text-xs font-semibold text-[var(--heading)]">{name}</span>
                </Link>
                {tabs.map(({ label, segment, icon: Icon }) => (
                    <Link
                        key={segment}
                        href={`${base}/${segment}`}
                        className={cn(
                            "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.05em] transition-colors",
                            isActive(segment) ? "border-[var(--campus)] text-[var(--campus)] bg-[var(--campus-bg)]" : "border-transparent text-[var(--text-2)]",
                        )}
                    >
                        <Icon size={14} className="shrink-0" />
                        {label}
                    </Link>
                ))}
            </nav>
        </>
    );
}
