"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  GraduationCap,
  Link2Off,
  LogOut,
  Menu,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Logo as LogoBadge } from "@/components/ui/Logo";
import { isSmallScreen } from "@/lib/isSmallScreen";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { NAV_GROUPS, NOTIFICATIONS_CHANGED, findLink, type NavLink } from "@/lib/student-nav";
import { linkedinState, linkedinTrusted, merged } from "@/lib/linkedinState";
import type { User as StudentUser } from "@/types";

function LinkedInStatusIndicator({ user }: { user: StudentUser }) {
  const state = linkedinState(user);
  if (state === "normal") {
    return (
      <span title="User is not connected through LinkedIn" className="inline-flex items-center text-gray-400 hover:text-gray-500 transition-colors">
        <Link2Off className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (linkedinTrusted(user)) {
    return (
      <span title={merged ? "LinkedIn connected" : "User is LinkedIn verified"} className="inline-flex items-center text-[#0a66c2] hover:opacity-85 transition-opacity">
        <BadgeCheck className="h-4 w-4 fill-[#0a66c2]/10" />
      </span>
    );
  }
  return (
    <span title="User is not verified on LinkedIn" className="inline-flex items-center text-amber-500 hover:text-amber-600 transition-colors animate-pulse">
      <AlertTriangle className="h-4 w-4 fill-amber-100" />
    </span>
  );
}

function Logo({ username }: { username?: string }) {
  const href = username ? `/user/${username}/overview` : "/user";
  return (
    <Link href={href} className="flex items-center shrink-0" aria-label="iFind overview">
      <LogoBadge size="md" />
    </Link>
  );
}

export function StudentShell({ children, user }: { children: React.ReactNode; user: StudentUser }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const username = params?.username as string;

  // Hamburger drawer for small screens
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Group sheet for lower tab bar on small screens
  const [sheet, setSheet] = useState<{ group: string; at: string } | null>(null);
  const openGroup = sheet && sheet.at === pathname ? NAV_GROUPS.find((g) => g.key === sheet.group) : undefined;

  const [unread, setUnread] = useState(0);

  // Remember last tab in localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && pathname) {
      localStorage.setItem("ifind_student_last_tab", pathname);
      localStorage.setItem("ifind_last_active_portal", "student");
    }
  }, [pathname]);

  // Refresh the badge on navigation, when the notifications page changes it, and every 60 s
  useEffect(() => {
    const refresh = () =>
      fetch("/api/user/notifications?countOnly=1", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setUnread(j.data.unread))
        .catch(() => {});
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    const t = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      clearInterval(t);
    };
  }, [pathname]);

  // Close menus on navigation
  useEffect(() => {
    setDrawerOpen(false);
    setSheet(null);
  }, [pathname]);

  const base = `/user/${username}`;
  const href = (l: NavLink) => `${base}/${l.path}`;
  const isActive = (l: NavLink) => pathname === href(l) || pathname.startsWith(`${href(l)}/`);
  const current = findLink(pathname);
  const isBrowse = current?.link.path === "browse";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (typeof window !== "undefined") {
      localStorage.removeItem("ifind_student_last_tab");
      localStorage.removeItem("ifind_last_active_portal");
    }
    const isMobile = isSmallScreen();
    router.push(isMobile ? "/phone" : "/user");
  };

  const linkCls = (active: boolean) =>
    cn(
      "relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-[13.5px] transition-colors",
      active ? "bg-[var(--primary)] text-white font-semibold" : "font-medium text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)]",
    );

  const sidebarContent = (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) =>
          group.links.length === 1 ? (
            <Link key={group.key} href={href(group.links[0])} className={linkCls(isActive(group.links[0]))}>
              <group.icon className="h-4 w-4" />
              {group.label}
            </Link>
          ) : (
            <div key={group.key}>
              <p className="px-3 mb-1 text-[10px] font-bold font-mono uppercase tracking-[0.08em] text-[var(--text-2)]">{group.label}</p>
              <div className="space-y-0.5">
                {group.links
                  .filter((l) => !l.hidden)
                  .map((l) => (
                    <Link key={l.path} href={href(l)} className={linkCls(isActive(l))}>
                      <l.icon className="h-4 w-4" />
                      {l.label}
                      {l.path === "notifications" && unread > 0 && (
                        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-[11px] leading-5 text-center">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </Link>
                  ))}
              </div>
            </div>
          ),
        )}
      </nav>

      <div className="shrink-0 border-t border-[var(--border)] p-3 space-y-3">
        <div className="px-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-3)] mb-1">
            <span>Profile completion</span>
            <span>{user.profileCompletionScore}%</span>
          </div>
          <ProgressBar value={user.profileCompletionScore} />
        </div>
        <ThemeSwitcher />
        <div className="flex items-center gap-1">
          <Link href={`${base}/profile`} className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors">
            <Avatar src={user.profilePicture} name={user.name} size="xs" />
            <span className="text-sm font-medium text-[var(--text)] truncate">{user.name}</span>
            <LinkedInStatusIndicator user={user} />
          </Link>
          <button onClick={handleLogout} title="Logout" className="p-2 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-dvh lg:h-screen flex flex-col lg:flex-row overflow-hidden bg-[var(--bg)]">
      {/* ── Desktop Sidebar (large screens) ───────────────────────────────── */}
      <aside className="hidden lg:flex w-60 shrink-0 h-full flex-col border-r-2 border-[var(--rule)] bg-[var(--surface)]">
        <div className="px-4 h-14 flex items-center shrink-0 border-b-2 border-[var(--rule)]">
          <Logo username={user.username} />
        </div>
        {sidebarContent}
      </aside>

      {/* ── Mobile Drawer Sidebar (slide out on hamburger click) ─────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[var(--overlay)] transition-opacity" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-[var(--surface)] border-r-2 border-[var(--rule)] shadow-2xl z-50" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 h-14 flex items-center justify-between shrink-0 border-b-2 border-[var(--rule)]">
              <Logo username={user.username} />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="p-1.5 text-[var(--text-3)] hover:text-[var(--heading)] rounded-[var(--radius-sm)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* ── Main Layout (Header + Scrollable Body + Bottom Bar) ───────────── */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* ── Top Bar (small screens): Header with Hamburger ───────────────── */}
        <header className="lg:hidden h-14 shrink-0 flex items-center justify-between px-4 bg-[var(--surface)] border-b-2 border-[var(--rule)] plasma-glass z-30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="p-1.5 -ml-1 text-[var(--text)] hover:text-[var(--primary)] rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo username={user.username} />
          </div>
          <div className="flex items-center gap-3">
            <Link href={`${base}/notifications`} aria-label="Notifications" className="relative p-1.5 text-[var(--text-2)]">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] leading-4 text-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <Link href={`${base}/profile`} aria-label="Profile">
              <Avatar src={user.profilePicture} name={user.name} size="sm" />
            </Link>
          </div>
        </header>

        {/* ── Scrollable Page Content (Scrollbar strictly between header and navbar) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-8">
            <PageHeader
              title={current ? (current.link.title ?? current.link.label) : "Dashboard"}
              status={isBrowse ? undefined : "Online"}
              action={
                isBrowse ? (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("open-browse-filters"))}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-sm)] text-xs font-semibold bg-[var(--primary-bg)] text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all shadow-xs"
                    aria-label="Open Filters"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Filters</span>
                  </button>
                ) : undefined
              }
            />
            {children}
          </main>
        </div>

        {/* ── Bottom Bar Group Sheet (small screens) ───────────────────────── */}
        {openGroup && (
          <div className="lg:hidden fixed inset-0 z-40 bg-[var(--overlay)]" onClick={() => setSheet(null)}>
            <div className="absolute inset-x-0 bottom-14 rounded-t-[var(--radius-2xl)] border-t-2 border-[var(--rule)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-xs font-semibold font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">{openGroup.label}</p>
                <button onClick={() => setSheet(null)} aria-label="Close" className="p-1 text-[var(--text-3)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {openGroup.links
                .filter((l) => !l.hidden)
                .map((l) => (
                  <Link key={l.path} href={href(l)} className={linkCls(isActive(l))}>
                    <l.icon className="h-4 w-4" />
                    {l.label}
                    {l.path === "notifications" && unread > 0 && (
                      <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-[11px] leading-5 text-center">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                ))}
              {openGroup.key === "system" && (
                <>
                  <ThemeSwitcher className="my-2" />
                  <button onClick={handleLogout} className={cn(linkCls(false), "w-full text-[var(--danger)]")}>
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom Tab Bar (small screens: 5 tabs with highlighted Campus circle in center) ── */}
        <nav className="lg:hidden h-14 shrink-0 flex items-center bg-[var(--surface)] border-t-2 border-[var(--rule)] z-30">
          {/* Tab 1: Home */}
          {(() => {
            const homeGroup = NAV_GROUPS.find((g) => g.key === "home")!;
            const active = current?.group.key === "home";
            return (
              <Link
                href={href(homeGroup.links[0])}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.04em] transition-colors",
                  active ? "text-[var(--primary)] bg-[var(--primary-bg)]" : "text-[var(--text-3)]",
                )}
              >
                <homeGroup.icon className="h-5 w-5" />
                {homeGroup.label}
              </Link>
            );
          })()}

          {/* Tab 2: Internships / Browse */}
          {(() => {
            const internGroup = NAV_GROUPS.find((g) => g.key === "internships")!;
            const active = current?.group.key === "internships" && !pathname.includes("/campus");
            return (
              <button
                type="button"
                onClick={() => setSheet(openGroup?.key === "internships" ? null : { group: "internships", at: pathname })}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.04em] transition-colors",
                  active ? "text-[var(--primary)] bg-[var(--primary-bg)]" : "text-[var(--text-3)]",
                )}
              >
                <internGroup.icon className="h-5 w-5" />
                Browse
              </button>
            );
          })()}

          {/* Tab 3 (CENTER): Campus Internship highlighted in circle bump */}
          <div className="flex-1 flex items-center justify-center">
            <Link
              href={`${base}/campus`}
              aria-label="Campus Internships"
              className="relative -top-3 flex flex-col items-center justify-center group focus:outline-hidden"
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 border-2",
                  pathname.includes("/campus")
                    ? "bg-[var(--primary)] text-white border-white dark:border-zinc-800 ring-2 ring-[var(--primary)]"
                    : "bg-[var(--primary)] text-white border-[var(--surface)] hover:scale-105",
                )}
              >
                <GraduationCap className="h-6 w-6" />
              </div>
              <span
                className={cn(
                  "text-[9px] font-mono font-bold uppercase tracking-[0.03em] mt-0.5",
                  pathname.includes("/campus") ? "text-[var(--primary)]" : "text-[var(--text-3)]",
                )}
              >
                Campus
              </span>
            </Link>
          </div>

          {/* Tab 4: Tools */}
          {(() => {
            const toolsGroup = NAV_GROUPS.find((g) => g.key === "tools")!;
            const active = current?.group.key === "tools";
            return (
              <button
                type="button"
                onClick={() => setSheet(openGroup?.key === "tools" ? null : { group: "tools", at: pathname })}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.04em] transition-colors",
                  active ? "text-[var(--primary)] bg-[var(--primary-bg)]" : "text-[var(--text-3)]",
                )}
              >
                <toolsGroup.icon className="h-5 w-5" />
                {toolsGroup.label}
              </button>
            );
          })()}

          {/* Tab 5: System */}
          {(() => {
            const sysGroup = NAV_GROUPS.find((g) => g.key === "system")!;
            const active = current?.group.key === "system";
            return (
              <button
                type="button"
                onClick={() => setSheet(openGroup?.key === "system" ? null : { group: "system", at: pathname })}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.04em] transition-colors",
                  active ? "text-[var(--primary)] bg-[var(--primary-bg)]" : "text-[var(--text-3)]",
                )}
              >
                <sysGroup.icon className="h-5 w-5" />
                {sysGroup.label}
              </button>
            );
          })()}
        </nav>
      </div>
    </div>
  );
}
