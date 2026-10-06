"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Briefcase, Building2, LogOut, Menu, Settings, UserCircle, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
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
    // Drawer is open only for the path it was opened on, so navigating closes it
    const [openAt, setOpenAt] = useState<string | null>(null);
    const open = openAt === pathname;
    const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
    const [unread, setUnread] = useState(initialUnread);

    // Inside a company the global sidebar collapses to icons (expands on hover, desktop only)
    const collapsed = pathname.startsWith("/employer/company/");
    const labelCls = collapsed ? "md:opacity-0 md:group-hover:opacity-100" : "";

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

    return (
        <div className="flex min-h-screen bg-[var(--bg)]">
            {/* Structural spacer: keeps content clear of the fixed sidebar */}
            <div className={cn("hidden md:block shrink-0 transition-[width] duration-300", collapsed ? "w-16" : "w-56")} />

            {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

            <aside
                className={cn(
                    "group fixed inset-y-0 left-0 z-50 flex w-56 flex-col justify-between overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] py-5 transition-[width,transform] duration-300",
                    open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                    collapsed && "md:w-16 md:hover:w-56 md:hover:shadow-[var(--shadow-lg)]",
                )}
            >
                <div className="flex w-56 flex-col gap-6 px-3">
                    <div className="flex items-center justify-between px-1">
                        <Link href="/employer/companies" className="flex items-center gap-2.5" title="iFind for Employers">
                            <div className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-white" />
                            </div>
                            <span className={cn("whitespace-nowrap text-base font-bold text-[var(--text)] transition-opacity duration-300", labelCls)}>
                                i<span className="text-[var(--primary)]">Find</span>
                            </span>
                        </Link>
                        <button className="md:hidden p-1 text-[var(--text-3)]" aria-label="Close menu" onClick={() => setOpen(false)}>
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 px-1">
                        <Avatar src={picture} name={name} size="md" />
                        <div className={cn("min-w-0 transition-opacity duration-300", labelCls)}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Employer</p>
                            <p className="truncate text-sm font-medium text-[var(--text)]">{name}</p>
                        </div>
                    </div>

                    <nav className="flex flex-col gap-1">
                        {NAV.map(({ label, href, icon: Icon }) => {
                            const active = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    title={label}
                                    aria-label={label}
                                    className={cn(
                                        "relative flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2.5 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-[var(--primary-bg)] text-[var(--primary)]"
                                            : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                                    )}
                                >
                                    <Icon size={20} className="shrink-0" />
                                    <span className={cn("whitespace-nowrap transition-opacity duration-300", labelCls)}>{label}</span>
                                    {href === "/employer/notifications" && unread > 0 && (
                                        <span className="absolute left-6 top-1 min-w-4 h-4 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] leading-4 text-center">
                                            {unread > 99 ? "99+" : unread}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="w-56 px-3">
                    <button
                        onClick={logout}
                        title="Log out"
                        aria-label="Log out"
                        className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2.5 text-sm font-medium text-[var(--text-3)] transition-colors hover:bg-red-50 hover:text-[var(--danger)]"
                    >
                        <LogOut size={20} className="shrink-0" />
                        <span className={cn("whitespace-nowrap transition-opacity duration-300", labelCls)}>Log out</span>
                    </button>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                {/* Mobile top bar */}
                <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
                    <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-1 text-[var(--text-2)]">
                        <Menu className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-bold text-[var(--text)]">
                        i<span className="text-[var(--primary)]">Find</span> <span className="text-xs font-normal text-[var(--text-3)]">Employers</span>
                    </span>
                </header>
                <div className="flex min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
