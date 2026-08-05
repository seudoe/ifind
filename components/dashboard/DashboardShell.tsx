"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard, Search, FileText, Bookmark, User,
  Settings, Briefcase, LogOut,
} from "lucide-react";
import { cn }          from "@/lib/utils";
import { Avatar }      from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";

// ── Nav definition ────────────────────────────────────────────────────────
const NAV = [
  { tab: "overview", label: "Overview", icon: LayoutDashboard },
  { tab: "browse",   label: "Browse",   icon: Search },
  { tab: "resume",   label: "Resume",   icon: FileText },
  { tab: "saved",    label: "Saved",    icon: Bookmark },
  { tab: "profile",  label: "Profile",  icon: User },
  { tab: "settings", label: "Settings", icon: Settings },
];

// ── Mock user — replace with real auth context later ──────────────────────
const MOCK = {
  name: "Rahul Sharma",
  username: "rahulsharma",
  profilePicture: null as string | null,
  profileCompletionScore: 35,
};

interface Props {
  activeTab: string;
  children: React.ReactNode;
}

export function DashboardShell({ activeTab, children }: Props) {
  const params   = useParams();
  const router   = useRouter();
  const username = (params?.username as string) ?? MOCK.username;

  const href = (tab: string) =>
    tab === "profile"
      ? `/user/${username}/profile`
      : `/user/${username}/${tab}`;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/user");
  };

  const TAB_TITLES: Record<string, string> = {
    overview: "Overview",
    browse:   "Browse Internships",
    resume:   "My Resume",
    saved:    "Saved",
    profile:  "My Profile",
    settings: "Settings",
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">

      {/* ── Top Navbar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] plasma-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-4">

            {/* Logo */}
            <Link href="/user" className="flex items-center gap-2 shrink-0 mr-2">
              <div className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center">
                <Briefcase className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-base font-bold text-[var(--text)]">
                i<span className="text-[var(--primary)]">Find</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1">
              {NAV.map(({ tab, label, icon: Icon }) => {
                const active = activeTab === tab;
                return (
                  <Link
                    key={tab}
                    href={href(tab)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-[var(--transition)] relative",
                      active
                        ? "bg-[var(--primary-bg)] text-[var(--primary)]"
                        : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
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

            {/* User + logout */}
            <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <span>{MOCK.profileCompletionScore}%</span>
                <div className="w-16"><ProgressBar value={MOCK.profileCompletionScore} /></div>
              </div>
              <Link
                href={href("profile")}
                className="flex items-center gap-2 px-2 py-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <Avatar src={MOCK.profilePicture} name={MOCK.name} size="xs" />
                <span className="text-sm font-medium text-[var(--text)] max-w-[100px] truncate">{MOCK.name}</span>
              </Link>
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

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        <h1 className="text-base font-semibold text-[var(--text)] mb-5">
          {TAB_TITLES[activeTab] ?? "Dashboard"}
        </h1>
        {children}
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] flex">
        {NAV.filter((n) => n.tab !== "settings").map(({ tab, label, icon: Icon }) => {
          const active = activeTab === tab;
          return (
            <Link
              key={tab}
              href={href(tab)}
              className={cn(
                "flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors gap-0.5",
                active ? "text-[var(--primary)]" : "text-[var(--text-3)]"
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
