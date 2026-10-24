"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, LogOut, Settings, UserCircle, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Companies", href: "/employer/companies", icon: Building2 },
    { label: "Profile", href: "/employer/profile", icon: UserCircle },
    { label: "Settings", href: "/employer/settings", icon: Settings },
    { label: "Notifications", href: "/employer/notifications", icon: Bell },
];

interface Props {
    name: string;
    picture?: string | null;
    unread: number;
    children: React.ReactNode;
}

export function EmployerShell({ name, picture, unread: initialUnread, children }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const [unread, setUnread] = useState(initialUnread);

    // Refresh the bell count on navigation and every 60 s
    useEffect(() => {
        const refresh = () =>
            fetch("/api/employer/notifications?countOnly=1", { credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .then((j) => j && setUnread(j.data.unread))
                .catch(() => {});
        refresh();
        const t = setInterval(refresh, 60_000);
        return () => clearInterval(t);
    }, [pathname]);

    const logout = async () => {
        await fetch("/api/employer/auth/logout", { method: "POST", credentials: "include" });
        router.push("/employer/login");
    };

    const badge = unread > 0 && (
        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-[var(--radius-xl)] bg-[var(--danger)] text-white text-[11px] leading-5 text-center">
            {unread > 99 ? "99+" : unread}
        </span>
    );

    return (
        <div className="flex min-h-screen bg-[var(--bg)]">
            {/* ── Sidebar (md and up) — always expanded, never collapses ─────────── */}
            <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-56 flex-col justify-between border-r-2 border-[var(--rule)] bg-[var(--surface)]">
                <div className="flex flex-col">
                    <div className="h-14 px-4 flex items-center border-b-2 border-[var(--rule)]">
                        <Link href="/employer/companies" title="iFind for Employers" aria-label="iFind for Employers"><Logo size="md" /></Link>
                    </div>
                    <p className="label px-4 pt-4 pb-3 !text-[10px] !text-[var(--text-2)]">Employer portal</p>

                    <nav className="flex flex-col gap-0.5 px-3">
                        {NAV.map(({ label, href, icon: Icon }) => {
                            const active = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        "relative flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] transition-colors",
                                        active
                                            ? "bg-[var(--primary)] text-white font-semibold"
                                            : "font-medium text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)]",
                                    )}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {label}
                                    {href === "/employer/notifications" && badge}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="border-t border-[var(--border)] p-3 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Avatar src={picture} name={name} size="sm" />
                        <span className="truncate text-sm font-medium text-[var(--text)]">{name}</span>
                    </div>
                    <ThemeSwitcher />
                    <button
                        onClick={logout}
                        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                        <LogOut className="h-3.5 w-3.5" /> Log out
                    </button>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col md:pl-56">
                {/* ── Top bar (small screens) ─────────────────────────────────────── */}
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b-2 border-[var(--rule)] bg-[var(--surface)] px-4 md:hidden">
                    <Link href="/employer/companies" aria-label="iFind for Employers"><Logo size="md" /></Link>
                    <div className="flex items-center gap-3">
                        <ThemeSwitcher compact className="w-28" />
                        <button onClick={logout} aria-label="Log out" className="p-1.5 text-[var(--text-3)] hover:text-[var(--danger)]"><LogOut className="h-4 w-4" /></button>
                    </div>
                </header>

                <div className="flex min-w-0 flex-1 flex-col md:flex-row pb-16 md:pb-0">{children}</div>
            </div>

            {/* ── Bottom tab bar (small screens) — tabs stay visible ──────────────── */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-14 flex border-t-2 border-[var(--rule)] bg-[var(--surface)]">
                {NAV.map(({ label, href, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "relative flex-1 flex flex-col items-center justify-center gap-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.04em] transition-colors",
                                active ? "text-[var(--primary)] bg-[var(--primary-bg)]" : "text-[var(--text-3)]",
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {label}
                            {href === "/employer/notifications" && unread > 0 && (
                                <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 h-4 px-1 rounded-[var(--radius-xl)] bg-[var(--danger)] text-white text-[10px] leading-4 text-center">
                                    {unread > 99 ? "99+" : unread}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
