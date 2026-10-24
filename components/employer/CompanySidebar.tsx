"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Building2, ChevronsUpDown, LayoutDashboard, PlusCircle, Briefcase, Settings, Users, UserSearch,
    type LucideIcon,
} from "lucide-react";
import { VerificationBadge } from "@/components/employer/VerificationBadge";
import { cn } from "@/lib/utils";
import type { MemberRole, VerificationStatus } from "@/types/employer";

const TABS: { label: string; segment: string; icon: LucideIcon; minRole: MemberRole }[] = [
    { label: "Overview", segment: "overview", icon: LayoutDashboard, minRole: "recruiter" },
    { label: "Internships", segment: "internships", icon: Briefcase, minRole: "recruiter" },
    { label: "Post New Internship", segment: "post-new-internship", icon: PlusCircle, minRole: "recruiter" },
    { label: "Applicants", segment: "applicants", icon: UserSearch, minRole: "recruiter" },
    { label: "Team", segment: "team", icon: Users, minRole: "admin" },
    { label: "Settings", segment: "settings", icon: Settings, minRole: "admin" },
];
const RANK: Record<MemberRole, number> = { recruiter: 1, admin: 2, owner: 3 };

interface Props {
    companyId: string;
    name: string;
    logo?: string | null;
    verification: VerificationStatus;
    role: MemberRole;
    companies: { _id: string; name: string }[];
}

export function CompanySidebar({ companyId, name, logo, verification, role, companies }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const [switcher, setSwitcher] = useState(false);
    const base = `/employer/company/${companyId}`;

    const body = (
        <>
            <div className="px-3 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                    {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt={name} className="h-9 w-9 rounded-[var(--radius-sm)] object-cover shrink-0" />
                    ) : (
                        <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-[var(--primary)]" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{name}</p>
                        <VerificationBadge status={verification} />
                    </div>
                </div>

                <div className="relative mt-3">
                    <button
                        onClick={() => setSwitcher((s) => !s)}
                        className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                        aria-expanded={switcher}
                    >
                        Switch company <ChevronsUpDown className="h-3.5 w-3.5" />
                    </button>
                    {switcher && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                            {companies.map((c) => (
                                <button
                                    key={c._id}
                                    onClick={() => { setSwitcher(false); router.push(`/employer/company/${c._id}/overview`); }}
                                    className={cn(
                                        "block w-full truncate px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]",
                                        c._id === companyId && "font-semibold text-[var(--primary)]",
                                    )}
                                >
                                    {c.name}
                                </button>
                            ))}
                            <Link href="/employer/companies" className="block border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)] hover:bg-[var(--surface-2)]">
                                All companies
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex flex-col gap-1 px-3 pt-3">
                {TABS.filter((t) => RANK[role] >= RANK[t.minRole]).map(({ label, segment, icon: Icon }) => {
                    const href = `${base}/${segment}`;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                        <Link
                            key={segment}
                            href={href}
                            className={cn(
                                "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] transition-colors",
                                active
                                    ? "bg-[var(--primary)] text-white font-semibold"
                                    : "font-medium text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)]",
                            )}
                        >
                            <Icon size={18} className="shrink-0" />
                            {label}
                        </Link>
                    );
                })}
            </nav>
        </>
    );

    return (
        <>
            {/* Desktop */}
            <aside className="hidden md:flex sticky top-0 h-screen self-start overflow-y-auto w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] py-5">
                {body}
            </aside>

            {/* Mobile: scrollable tab strip — the tabs stay on screen */}
            <nav className="md:hidden sticky top-14 z-20 flex items-stretch overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)]" aria-label="Company sections">
                <Link href="/employer/companies" className="flex items-center gap-2 border-r border-[var(--border)] px-3 max-w-[40%] shrink-0" title="All companies">
                    <Building2 className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                    <span className="truncate text-xs font-semibold text-[var(--heading)]">{name}</span>
                </Link>
                {TABS.filter((t) => RANK[role] >= RANK[t.minRole]).map(({ label, segment, icon: Icon }) => {
                    const href = `${base}/${segment}`;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                        <Link
                            key={segment}
                            href={href}
                            className={cn(
                                "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.05em] transition-colors",
                                active ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-bg)]" : "border-transparent text-[var(--text-2)]",
                            )}
                        >
                            <Icon size={14} className="shrink-0" />
                            {label}
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
