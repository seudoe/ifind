"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Building2, ChevronsUpDown, LayoutDashboard, Menu, PlusCircle, Briefcase, Settings, Users, UserSearch, X,
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
    const [openAt, setOpenAt] = useState<string | null>(null);
    const open = openAt === pathname;
    const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
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
                                "flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors",
                                active
                                    ? "bg-[var(--primary-bg)] text-[var(--primary)]"
                                    : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
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

            {/* Mobile: trigger + drawer */}
            <button
                onClick={() => setOpen(true)}
                aria-label="Open company menu"
                className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-lg)]"
            >
                <Menu className="h-4 w-4" /> {name}
            </button>
            {open && <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />}
            <aside
                className={cn(
                    "md:hidden fixed inset-y-0 right-0 z-50 flex w-64 flex-col bg-[var(--surface)] py-5 transition-transform duration-300",
                    open ? "translate-x-0" : "translate-x-full",
                )}
            >
                <button className="absolute right-3 top-3 p-1 text-[var(--text-3)]" aria-label="Close company menu" onClick={() => setOpen(false)}>
                    <X className="h-5 w-5" />
                </button>
                <div className="mt-6 flex flex-col">{body}</div>
            </aside>
        </>
    );
}
