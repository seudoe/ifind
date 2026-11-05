"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Bell,
    Building2,
    LogOut,
    Menu,
    Monitor,
    Moon,
    Settings,
    Sun,
    UserCircle,
    X,
    type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import { isSmallScreen } from "@/lib/isSmallScreen";
import { useAndroidBackHandler } from "@/hooks/useAndroidBackHandler";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Institutes", href: "/employer/institutes", icon: Building2 },
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

const NEXT_THEME: Record<ThemePreference, ThemePreference> = { light: "dark", dark: "system", system: "light" };
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

/** Icon-only theme toggle for the collapsed sidebar: cycles light, dark, system. */
function ThemeCycle() {
    const { preference, setPreference } = useTheme();
    const Icon = THEME_ICON[preference];
    return (
        <button
            type="button"
            onClick={() => setPreference(NEXT_THEME[preference])}
            title={`Theme: ${preference} (click to change)`}
            aria-label="Change colour theme"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--heading)]"
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

export function EmployerShell({ name, picture, unread: initialUnread, children }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const [unread, setUnread] = useState(initialUnread);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Remember last tab in localStorage
    useEffect(() => {
        if (typeof window !== "undefined" && pathname) {
            localStorage.setItem("ifind_employer_last_tab", pathname);
            localStorage.setItem("ifind_last_active_portal", "employer");
        }
    }, [pathname]);

    // On fresh session start, restore last opened tab if user previously had another tab open
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (sessionStorage.getItem("ifind_employer_resumed") === "true") return;
        sessionStorage.setItem("ifind_employer_resumed", "true");

        if (pathname === "/employer/institutes") {
            const stored = localStorage.getItem("ifind_employer_last_tab");
            if (stored && stored.startsWith("/employer/") && stored !== pathname) {
                router.replace(stored);
            }
        }
    }, [pathname, router]);

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

    // Close drawer on navigation
    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    // Hardware/gesture back button support for Android
    useAndroidBackHandler(() => {
        if (drawerOpen) {
            setDrawerOpen(false);
            return true;
        }
        return false;
    });

    const logout = async () => {
        await fetch("/api/employer/auth/logout", { method: "POST", credentials: "include" });
        if (typeof window !== "undefined") {
            localStorage.removeItem("ifind_employer_last_tab");
            localStorage.removeItem("ifind_last_active_portal");
        }
        const isMobile = isSmallScreen();
        router.push(isMobile ? "/phone" : "/employer/login");
    };

    // Inside a company or campus the global sidebar shrinks to icons on desktop.
    // On small screens, the institute-wise sidebar becomes the lower navbar.
    const collapsed = pathname.startsWith("/employer/company/") || pathname.startsWith("/employer/campus/");
    const labelCls = collapsed ? "md:opacity-0 md:group-hover:opacity-100" : "";

    const badge = unread > 0 && (
        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-[var(--radius-xl)] bg-[var(--danger)] text-white text-[11px] leading-5 text-center">
            {unread > 99 ? "99+" : unread}
        </span>
    );

    const navLinks = (
        <nav className="flex flex-col gap-0.5 px-3">
            {NAV.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
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
                        <span className={cn("whitespace-nowrap transition-opacity duration-300", labelCls)}>{label}</span>
                        {href === "/employer/notifications" && badge}
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="h-dvh md:h-screen flex flex-col md:flex-row overflow-hidden bg-[var(--bg)]">
            {/* ── Desktop Global Sidebar (md and up) ─────────────────────────── */}
            <aside
                className={cn(
                    "group hidden md:flex shrink-0 h-full flex-col justify-between overflow-hidden border-r-2 border-[var(--rule)] bg-[var(--surface)] transition-[width,box-shadow] duration-300 z-40",
                    collapsed ? "w-16 hover:w-56 hover:shadow-[var(--shadow-lg)]" : "w-56",
                )}
            >
                <div className="flex w-56 flex-col">
                    <div className="h-14 px-4 flex items-center border-b-2 border-[var(--rule)]">
                        <Link href="/employer/institutes" title="iFind for Employers" aria-label="iFind for Employers">
                            {collapsed && <Logo size="md" suffix="" className="md:group-hover:hidden" />}
                            <Logo size="md" className={collapsed ? "hidden md:group-hover:inline-flex" : ""} />
                        </Link>
                    </div>
                    <p className={cn("label px-4 pt-4 pb-3 !text-[10px] !text-[var(--text-2)] whitespace-nowrap transition-opacity duration-300", labelCls)}>
                        Employer portal
                    </p>
                    {navLinks}
                </div>

                <div className="w-56 border-t border-[var(--border)] p-3">
                    {collapsed && (
                        <div className="flex w-10 flex-col items-center gap-3 md:group-hover:hidden">
                            <Avatar src={picture} name={name} size="sm" />
                            <ThemeCycle />
                            <button
                                onClick={logout}
                                title="Log out"
                                aria-label="Log out"
                                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <div className={cn("space-y-3", collapsed && "hidden md:group-hover:block")}>
                        <div className="flex items-center gap-2 px-1">
                            <Avatar src={picture} name={name} size="sm" />
                            <span className={cn("truncate text-sm font-medium text-[var(--text)] transition-opacity duration-300", labelCls)}>{name}</span>
                        </div>
                        <ThemeSwitcher className={collapsed ? "md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" : ""} />
                        <button
                            onClick={logout}
                            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--text)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
                        >
                            <LogOut className="h-3.5 w-3.5 shrink-0" /> <span className="whitespace-nowrap">Log out</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Mobile Drawer (slide-out on hamburger click) ──────────────── */}
            {drawerOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-[var(--overlay)] transition-opacity" onClick={() => setDrawerOpen(false)}>
                    <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-[var(--surface)] border-r-2 border-[var(--rule)] shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 h-14 flex items-center justify-between shrink-0 border-b-2 border-[var(--rule)]">
                            <div className="pointer-events-none select-none flex items-center shrink-0">
                                <Logo size="md" />
                            </div>
                            <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="p-1.5 text-[var(--text-3)] hover:text-[var(--heading)] rounded-[var(--radius-sm)]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
                            <Avatar src={picture} name={name} size="sm" />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--text)]">{name}</p>
                                <p className="text-xs text-[var(--text-3)]">Employer Portal</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto py-3">
                            {navLinks}
                        </div>

                        <div className="p-4 border-t border-[var(--border)] space-y-3">
                            <ThemeSwitcher />
                            <button
                                onClick={logout}
                                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
                            >
                                <LogOut className="h-4 w-4 shrink-0" /> <span>Log out</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Layout Column (Header + Scrollable Middle Content + Bottom Navbar) ── */}
            <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
                {/* ── Top Bar (small screens): Header with Hamburger ───────────── */}
                <header className="h-14 shrink-0 flex items-center justify-between gap-3 border-b-2 border-[var(--rule)] bg-[var(--surface)] px-4 md:hidden z-30">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open global menu"
                            className="p-1.5 -ml-1 text-[var(--text)] hover:text-[var(--primary)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="pointer-events-none select-none flex items-center shrink-0">
                            <Logo size="md" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeSwitcher compact className="w-28" />
                        <button onClick={logout} aria-label="Log out" className="p-1.5 text-[var(--text-3)] hover:text-[var(--danger)]">
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                {/* ── Scrollable Body Area (Scrollbar strictly between header and navbar) ── */}
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col md:flex-row">
                    {children}
                </div>

                {/* ── Bottom Tab Bar (small screens): Visible when NOT inside an institute (collapsed = false) ── */}
                {!collapsed && (
                    <nav className="md:hidden h-14 shrink-0 flex items-center border-t-2 border-[var(--rule)] bg-[var(--surface)] z-30">
                        {NAV.map(({ label, href, icon: Icon }) => {
                            const active = pathname === href || pathname.startsWith(`${href}/`);
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
                )}
            </div>
        </div>
    );
}
