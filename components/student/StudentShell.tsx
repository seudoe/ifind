"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, Bell, Link2Off, LogOut, X } from "lucide-react";
import { cn }          from "@/lib/utils";
import { Avatar }      from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Logo as LogoBadge } from "@/components/ui/Logo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { NAV_GROUPS, NOTIFICATIONS_CHANGED, findLink, type NavLink } from "@/lib/student-nav";
import type { User as StudentUser } from "@/types";

function LinkedInStatusIndicator({ linkedinDetails }: { linkedinDetails?: StudentUser["linkedinDetails"] }) {
  if (!linkedinDetails) {
    return (
      <span title="User is not connected through LinkedIn" className="inline-flex items-center text-gray-400 hover:text-gray-500 transition-colors">
        <Link2Off className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (linkedinDetails.email_verified) {
    return (
      <span title="User is LinkedIn verified" className="inline-flex items-center text-[#0a66c2] hover:opacity-85 transition-opacity">
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

function Logo() {
  return (
    <Link href="/user" className="flex items-center shrink-0" aria-label="iFind home">
      <LogoBadge size="md" />
    </Link>
  );
}

export function StudentShell({ children, user }: { children: React.ReactNode; user: StudentUser }) {
  const params   = useParams();
  const router   = useRouter();
  const pathname = usePathname();
  const username = params?.username as string;
  // The sheet is open only for the path it was opened on, so navigating closes it
  const [sheet, setSheet] = useState<{ group: string; at: string } | null>(null);
  const openGroup = sheet && sheet.at === pathname ? NAV_GROUPS.find((g) => g.key === sheet.group) : undefined;

  const [unread, setUnread] = useState(0);
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
    return () => { window.removeEventListener(NOTIFICATIONS_CHANGED, refresh); clearInterval(t); };
  }, [pathname]);

  const base = `/user/${username}`;
  const href = (l: NavLink) => `${base}/${l.path}`;
  const isActive = (l: NavLink) => pathname === href(l) || pathname.startsWith(`${href(l)}/`);
  const current = findLink(pathname);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/user");
  };

  const linkCls = (active: boolean) =>
    cn(
      "relative flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] text-[13.5px] transition-colors",
      active ? "bg-[var(--primary)] text-white font-semibold" : "font-medium text-[var(--text)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)]",
    );

  return (
    <div className="min-h-screen bg-[var(--bg)]">

      {/* ── Sidebar (large screens) ───────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r-2 border-[var(--rule)] bg-[var(--surface)]">
        <div className="px-4 h-14 flex items-center shrink-0 border-b-2 border-[var(--rule)]"><Logo /></div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) =>
            group.links.length === 1 ? (
              <Link key={group.key} href={href(group.links[0])} className={linkCls(isActive(group.links[0]))}>
                <group.icon className="h-4 w-4" />{group.label}
              </Link>
            ) : (
              <div key={group.key}>
                <p className="px-3 mb-1 text-[10px] font-bold font-mono uppercase tracking-[0.08em] text-[var(--text-2)]">{group.label}</p>
                <div className="space-y-0.5">
                  {group.links.filter((l) => !l.hidden).map((l) => (
                    <Link key={l.path} href={href(l)} className={linkCls(isActive(l))}>
                      <l.icon className="h-4 w-4" />{l.label}
                      {l.path === "notifications" && unread > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-[11px] leading-5 text-center">{unread > 99 ? "99+" : unread}</span>}
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
              <span>Profile completion</span><span>{user.profileCompletionScore}%</span>
            </div>
            <ProgressBar value={user.profileCompletionScore} />
          </div>
          <ThemeSwitcher />
          <div className="flex items-center gap-1">
            <Link href={`${base}/profile`} className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors">
              <Avatar src={user.profilePicture} name={user.name} size="xs" />
              <span className="text-sm font-medium text-[var(--text)] truncate">{user.name}</span>
              <LinkedInStatusIndicator linkedinDetails={user.linkedinDetails} />
            </Link>
            <button onClick={handleLogout} title="Logout" className="p-2 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Top bar (small screens) ───────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-[var(--surface)] border-b-2 border-[var(--rule)] plasma-glass">
        <Logo />
        <div className="flex items-center gap-3">
          <Link href={`${base}/notifications`} aria-label="Notifications" className="relative p-1.5 text-[var(--text-2)]">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] leading-4 text-center">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <Link href={`${base}/profile`} aria-label="Profile"><Avatar src={user.profilePicture} name={user.name} size="sm" /></Link>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="lg:pl-60">
        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          <PageHeader title={current ? (current.link.title ?? current.link.label) : "Dashboard"} status="Online" />
          {children}
        </main>
      </div>

      {/* ── Bottom bar + group sheet (small screens) ─────────────────────── */}
      {openGroup && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[var(--overlay)]" onClick={() => setSheet(null)}>
          <div className="absolute inset-x-0 bottom-14 rounded-t-[var(--radius-2xl)] border-t-2 border-[var(--rule)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">{openGroup.label}</p>
              <button onClick={() => setSheet(null)} aria-label="Close" className="p-1 text-[var(--text-3)]"><X className="h-4 w-4" /></button>
            </div>
            {openGroup.links.filter((l) => !l.hidden).map((l) => (
              <Link key={l.path} href={href(l)} className={linkCls(isActive(l))}><l.icon className="h-4 w-4" />{l.label}{l.path === "notifications" && unread > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-[11px] leading-5 text-center">{unread > 99 ? "99+" : unread}</span>}</Link>
            ))}
            {openGroup.key === "system" && (
              <>
                <ThemeSwitcher className="my-2" />
                <button onClick={handleLogout} className={cn(linkCls(false), "w-full text-[var(--danger)]")}><LogOut className="h-4 w-4" />Logout</button>
              </>
            )}
          </div>
        </div>
      )}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-14 flex bg-[var(--surface)] border-t-2 border-[var(--rule)]">
        {NAV_GROUPS.map((group) => {
          const active = current?.group.key === group.key;
          const cls = cn("flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.04em] transition-colors", active ? "text-[var(--primary)] bg-[var(--primary-bg)]" : "text-[var(--text-3)]");
          const inner = <><group.icon className="h-5 w-5" />{group.label}</>;
          return group.links.length === 1 ? (
            <Link key={group.key} href={href(group.links[0])} className={cls}>{inner}</Link>
          ) : (
            <button key={group.key} onClick={() => setSheet(openGroup?.key === group.key ? null : { group: group.key, at: pathname })} className={cls}>{inner}</button>
          );
        })}
      </nav>
    </div>
  );
}
