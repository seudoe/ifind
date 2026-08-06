"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  LayoutDashboard, Search, FileText, Bookmark, User,
  Settings, Briefcase, LogOut, AlertTriangle, BadgeCheck, Link2Off,
} from "lucide-react";
import { cn }          from "@/lib/utils";
import { Avatar }      from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { User as StudentUser } from "@/types";

// ── Nav definition ────────────────────────────────────────────────────────
const NAV = [
  { tab: "overview", label: "Overview", icon: LayoutDashboard },
  { tab: "browse",   label: "Browse",   icon: Search },
  { tab: "resume",   label: "Resume",   icon: FileText },
  { tab: "saved",    label: "Saved",    icon: Bookmark },
  { tab: "profile",  label: "Profile",  icon: User },
  { tab: "settings", label: "Settings", icon: Settings },
];

// ── Mock user ──────────────────────────────────────────────────────────────
const MOCK = {
  name: "Rahul Sharma",
  username: "rahulsharma",
  profilePicture: null as string | null,
  profileCompletionScore: 35,
};

function LinkedInStatusIndicator({ linkedinDetails }: { linkedinDetails?: StudentUser["linkedinDetails"] }) {
  if (!linkedinDetails) {
    // State C: Not connected through LinkedIn
    return (
      <span
        title="User is not connected through LinkedIn"
        className="inline-flex items-center text-gray-400 hover:text-gray-500 transition-colors"
      >
        <Link2Off className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (linkedinDetails.email_verified) {
    // State A: User is LinkedIn verified
    return (
      <span
        title="User is LinkedIn verified"
        className="inline-flex items-center text-[#0a66c2] hover:opacity-85 transition-opacity"
      >
        <BadgeCheck className="h-4 w-4 fill-[#0a66c2]/10" />
      </span>
    );
  }

  // State B: Connected but NOT verified on LinkedIn -> Show yellow danger triangle!
  return (
    <span
      title="User is not verified on LinkedIn"
      className="inline-flex items-center text-amber-500 hover:text-amber-600 transition-colors animate-pulse"
    >
      <AlertTriangle className="h-4 w-4 fill-amber-100" />
    </span>
  );
}

interface Props {
  activeTab: string;
  children: React.ReactNode;
  user?: StudentUser;
  maxWidthClass?: string;
  headerAction?: React.ReactNode;
}

export function DashboardShell({ activeTab, children, user, maxWidthClass = "max-w-6xl", headerAction }: Props) {
  const params   = useParams();
  const router   = useRouter();
  const username = (params?.username as string) ?? MOCK.username;
  const currentUser = user ?? MOCK;

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

  const linkedinDetails = "linkedinDetails" in currentUser ? currentUser.linkedinDetails : undefined;

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">

      {/* ── Top Navbar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] plasma-glass">
        <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 lg:px-8`}>
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

            {/* Mobile header action */}
            {headerAction && (
              <div className="ml-auto flex items-center shrink-0 lg:hidden">
                {headerAction}
              </div>
            )}

            {/* User + logout */}
            <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <span>{currentUser.profileCompletionScore}%</span>
                <div className="w-16"><ProgressBar value={currentUser.profileCompletionScore} /></div>
              </div>
              <Link
                href={href("profile")}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <Avatar src={currentUser.profilePicture} name={currentUser.name} size="xs" />
                <span className="text-sm font-medium text-[var(--text)] max-w-[100px] truncate">{currentUser.name}</span>
                <LinkedInStatusIndicator linkedinDetails={linkedinDetails} />
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
      <main className={`flex-1 ${maxWidthClass} mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6`}>
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
