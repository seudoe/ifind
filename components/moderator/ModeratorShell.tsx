"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
    Shield,
    Users,
    ListChecks,
    UserCheck,
    Activity,
    Gauge,
    Trophy,
    Briefcase,
    Building2,
    LogOut,
    AlertTriangle,
    BarChart3,
    ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import type { ModeratorSession } from "@/types/moderator";

type Tab = "internships" | "analyze" | "events" | "scrapes" | "usage" | "analytics" | "users" | "employers" | "companies" | "moderators";

// ── Nav definition (grouped) ──────────────────────────────────────────────
const NAV_GROUPS: { label: string; links: { tab: Tab; label: string; icon: typeof Users }[] }[] = [
    {
        label: "Content",
        links: [
            { tab: "internships", label: "Internships", icon: ListChecks },
            { tab: "analyze", label: "Analyze", icon: ScanSearch },
            { tab: "events", label: "Events", icon: Trophy },
        ],
    },
    {
        label: "Operations",
        links: [
            { tab: "scrapes", label: "Scrapes", icon: Activity },
            { tab: "usage", label: "Usage", icon: Gauge },
            { tab: "analytics", label: "Analytics", icon: BarChart3 },
        ],
    },
    {
        label: "People",
        links: [
            { tab: "users", label: "Users", icon: Users },
            { tab: "employers", label: "Employers", icon: Briefcase },
            { tab: "companies", label: "Companies", icon: Building2 },
            { tab: "moderators", label: "Moderators", icon: UserCheck },
        ],
    },
];
const NAV = NAV_GROUPS.flatMap((g) => g.links);

interface ModeratorShellProps {
    activeTab: Tab;
    children: React.ReactNode;
    moderator: ModeratorSession;
}

export function ModeratorShell({
    activeTab,
    children,
    moderator,
}: ModeratorShellProps) {
    const router = useRouter();
    const params = useParams();
    const username = params?.username as string || "me";

    const handleLogout = async () => {
        await fetch("/api/moderator/auth/logout", {
            method: "POST",
            credentials: "include",
        });
        router.push("/moderator/login");
    };

    const TAB_TITLES: Record<string, string> = {
        internships: "Internship Queue",
        analyze: "Analyze Internship",
        events: "Hackathons & Contests",
        scrapes: "Scrapes",
        usage: "AI Usage",
        analytics: "Analytics",
        users: "User Management",
        employers: "Employer Management",
        companies: "Company Management",
        moderators: "Moderator Accounts",
    };

    const Brand = (
        <Link href={`/moderator/${username}/internships`} className="flex items-center shrink-0" aria-label="iMod home">
            <Logo size="md" suffix="Mod" />
        </Link>
    );

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            {/* ── Sidebar (large screens) ──────────────────────────────────────── */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r-2 border-[var(--rule)] bg-[var(--surface)]">
                <div className="px-4 h-14 flex items-center shrink-0 border-b-2 border-[var(--rule)]">{Brand}</div>

                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                    {NAV_GROUPS.map((group) => (
                        <div key={group.label}>
                            <p className="px-3 mb-1 text-[10px] font-bold font-mono uppercase tracking-[0.08em] text-[var(--text-2)]">
                                {group.label}
                            </p>
                            <div className="space-y-0.5">
                                {group.links.map(({ tab, label, icon: Icon }) => (
                                    <Link
                                        key={tab}
                                        href={`/moderator/${username}/${tab}`}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-[13.5px] transition-colors",
                                            activeTab === tab
                                                ? "bg-[var(--primary)] text-white font-semibold"
                                                : "font-medium text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)]",
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="shrink-0 border-t border-[var(--border)] p-3 space-y-3">
                    <ThemeSwitcher />
                    <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5">
                        <Shield className="h-4 w-4 text-[var(--primary)] shrink-0" />
                        <span className="text-sm font-medium text-[var(--text)] truncate">
                            {moderator.name}
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        className="p-2 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                    </div>
                </div>
            </aside>

            {/* ── Top bar (small screens) ──────────────────────────────────────── */}
            <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-[var(--surface)] border-b-2 border-[var(--rule)] plasma-glass">
                {Brand}
                <div className="flex items-center gap-2">
                    <ThemeSwitcher compact className="w-28" />
                    <span className="hidden sm:inline text-sm font-medium text-[var(--text)] max-w-[100px] truncate">
                        {moderator.name}
                    </span>
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <div className="lg:pl-60">
                {/* ── Unverified warning banner ───────────────────────────────── */}
                {moderator.isVerified === false && (
                    <div className="bg-[var(--warning)]/10 border-b border-[var(--warning)]/30 text-[var(--warning)]">
                        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                                Your account is <strong>unverified</strong>. You can
                                view content but cannot perform any moderation
                                actions until an existing moderator verifies your
                                account.
                            </span>
                        </div>
                    </div>
                )}

                {/* ── Page content ────────────────────────────────────────────── */}
                <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
                    <PageHeader title={TAB_TITLES[activeTab] ?? "Moderator Panel"} status="Online" />
                    {children}
                </main>
            </div>

            {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t-2 border-[var(--rule)] flex overflow-x-auto">
                {NAV.map(({ tab, label, icon: Icon }) => (
                    <Link
                        key={tab}
                        href={`/moderator/${username}/${tab}`}
                        className={cn(
                            "flex-1 min-w-[68px] flex flex-col items-center py-2 text-[9.5px] font-mono font-bold uppercase tracking-[0.03em] transition-colors gap-0.5",
                            activeTab === tab
                                ? "text-[var(--primary)] bg-[var(--primary-bg)]"
                                : "text-[var(--text-3)]",
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
