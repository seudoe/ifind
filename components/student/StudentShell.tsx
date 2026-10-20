"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, Bell, Briefcase, Link2Off, LogOut, X } from "lucide-react";
import { cn }          from "@/lib/utils";
import { Avatar }      from "@/components/ui/Avatar";
import { DotGridBackground } from "@/components/ui/DotGridBackground";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { LineHoverStyles, LineHoverText } from "@/components/ui/line-hover-link";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { NAV_GROUPS, NOTIFICATIONS_CHANGED, findLink, type NavLink } from "@/lib/student-nav";
import type { User as StudentUser } from "@/types";

function LinkedInStatusIndicator({ linkedinDetails }: { linkedinDetails?: StudentUser["linkedinDetails"] }) {
  if (!linkedinDetails) {
    return (
      <span title="User is not connected through LinkedIn" className="inline-flex items-center text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
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
    <Link href="/user" className="flex items-center gap-2 shrink-0">
      <div className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center">
        <Briefcase className="h-4 w-4 text-white" />
      </div>
      <span className="text-base font-bold text-[var(--text)]">
        i<span className="text-[var(--primary)]">Find</span>
      </span>
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
      "nav-row flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium transition-colors",
      active ? "bg-[var(--primary-bg)] text-[var(--primary)]" : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
    );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <DotGridBackground className="lg:left-60" />
      <SmoothScroll />
      <LineHoverStyles />

      {/* ── Sidebar (large screens) ───────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="px-4 h-14 flex items-center shrink-0"><Logo /></div>

        <nav data-lenis-prevent className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {NAV_GROUPS.map((group) =>
            group.links.length === 1 ? (
              <Link key={group.key} href={href(group.links[0])} className={linkCls(isActive(group.links[0]))}>
                <group.icon className="h-[18px] w-[18px]" /><LineHoverText>{group.label}</LineHoverText>
              </Link>
            ) : (
              <div key={group.key}>
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">{group.label}</p>
                <div className="space-y-0.5">
                  {group.links.filter((l) => !l.hidden).map((l) => (
                    <Link key={l.path} href={href(l)} className={linkCls(isActive(l))}>
                      <l.icon className="h-[18px] w-[18px]" /><LineHoverText>{l.label}</LineHoverText>
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
          <div className="flex items-center gap-1">
            <Link href={`${base}/profile`} className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors">
              <Avatar src={user.profilePicture} name={user.name} size="xs" />
              <span className="text-sm font-medium text-[var(--text)] truncate">{user.name}</span>
              <LinkedInStatusIndicator linkedinDetails={user.linkedinDetails} />
            </Link>
            <button onClick={handleLogout} title="Logout" className="p-2 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Top bar (small screens) ───────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-[var(--surface)] border-b border-[var(--border)] plasma-glass">
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
      <div className="lg:pl-60 relative z-10">
        <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          <h1 className="text-xl font-semibold text-[var(--text)] mb-6">
            {current ? (current.link.title ?? current.link.label) : "Dashboard"}
          </h1>
          {children}
        </main>
      </div>

      {/* ── Bottom bar + group sheet (small screens) ─────────────────────── */}
      {openGroup && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setSheet(null)}>
          <div className="absolute inset-x-0 bottom-14 rounded-t-2xl bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">{openGroup.label}</p>
              <button onClick={() => setSheet(null)} aria-label="Close" className="p-1 text-[var(--text-3)]"><X className="h-4 w-4" /></button>
            </div>
            {openGroup.links.filter((l) => !l.hidden).map((l) => (
              <Link key={l.path} href={href(l)} className={linkCls(isActive(l))}><l.icon className="h-4 w-4" /><LineHoverText>{l.label}</LineHoverText>{l.path === "notifications" && unread > 0 && <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-[11px] leading-5 text-center">{unread > 99 ? "99+" : unread}</span>}</Link>
            ))}
            {openGroup.key === "system" && (
              <button onClick={handleLogout} className={cn(linkCls(false), "w-full text-[var(--danger)]")}><LogOut className="h-4 w-4" />Logout</button>
            )}
          </div>
        </div>
      )}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 h-14 flex bg-[var(--surface)] border-t border-[var(--border)]">
        {NAV_GROUPS.map((group) => {
          const active = current?.group.key === group.key;
          const cls = cn("flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors", active ? "text-[var(--primary)]" : "text-[var(--text-3)]");
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
