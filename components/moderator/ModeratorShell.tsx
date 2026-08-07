"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Shield,
    Users,
    ListChecks,
    UserCheck,
    LogOut,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModeratorSession } from "@/types/moderator";

// ── Nav definition ────────────────────────────────────────────────────────
const NAV = [
    {
        tab: "internships" as const,
        label: "Internships",
        icon: ListChecks,
        href: "/moderator/panel/internships",
    },
    {
        tab: "users" as const,
        label: "Users",
        icon: Users,
        href: "/moderator/panel/users",
    },
    {
        tab: "moderators" as const,
        label: "Moderators",
        icon: UserCheck,
        href: "/moderator/panel/moderators",
    },
];

interface ModeratorShellProps {
    activeTab: "internships" | "users" | "moderators";
    children: React.ReactNode;
    moderator: ModeratorSession;
}

export function ModeratorShell({
    activeTab,
    children,
    moderator,
}: ModeratorShellProps) {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch("/api/moderator/auth/logout", {
            method: "POST",
            credentials: "include",
        });
        router.push("/moderator/login");
    };

    const TAB_TITLES: Record<string, string> = {
        internships: "Internship Queue",
        users: "User Management",
        moderators: "Moderator Accounts",
    };

    return (
        <div className="min-h-screen bg-[var(--bg)] flex flex-col">
            {/* ── Top Navbar ───────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] plasma-glass">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-14 gap-4">
                        {/* Logo */}
                        <div className="flex items-center gap-2 shrink-0 mr-2">
                            <div className="h-7 w-7 rounded-[var(--radius-sm)] bg-amber-600 flex items-center justify-center">
                                <Shield className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span className="text-base font-bold text-[var(--text)]">
                                i<span className="text-amber-600">Mod</span>
                            </span>
                        </div>

                        {/* Desktop tab nav */}
                        <nav className="hidden md:flex items-center gap-0.5 flex-1">
                            {NAV.map(({ tab, label, icon: Icon, href }) => {
                                const active = activeTab === tab;
                                return (
                                    <Link
                                        key={tab}
                                        href={href}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-[var(--transition)] relative",
                                            active
                                                ? "bg-[var(--primary-bg)] text-[var(--primary)]"
                                                : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {label}
                                        {active && (
                                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4/5 rounded-full bg-[var(--primary)]" />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Moderator name + logout */}
                        <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                                <span className="text-sm font-medium text-[var(--text)] max-w-[160px] truncate">
                                    {moderator.name}
                                </span>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Logout"
                                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Mobile: name + logout */}
                        <div className="flex md:hidden items-center gap-2 ml-auto shrink-0">
                            <span className="text-sm font-medium text-[var(--text)] max-w-[100px] truncate">
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
                    </div>
                </div>
            </header>

            {/* ── Unverified warning banner ─────────────────────────────────────── */}
            {moderator.isVerified === false && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-600">
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

            {/* ── Page content ─────────────────────────────────────────────────── */}
            <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
                <h1 className="text-base font-semibold text-[var(--text)] mb-5">
                    {TAB_TITLES[activeTab] ?? "Moderator Panel"}
                </h1>
                {children}
            </main>

            {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] flex">
                {NAV.map(({ tab, label, icon: Icon, href }) => {
                    const active = activeTab === tab;
                    return (
                        <Link
                            key={tab}
                            href={href}
                            className={cn(
                                "flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors gap-0.5",
                                active
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--text-3)]",
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
