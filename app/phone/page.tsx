"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { safeNextPath } from "@/lib/authRedirect";
import { apiUrl } from "@/lib/apiOrigin";
import { useAndroidBackHandler } from "@/hooks/useAndroidBackHandler";

export default function PhoneLandingPage() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [role, setRole] = useState<"student" | "employer">("student");
  const [tab, setTab] = useState<"login" | "register">("login");

  // Form states
  const [emailOrUser, setEmailOrUser] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsLinkedIn, setNeedsLinkedIn] = useState(false);

  // Android back button closes sheet if open
  useAndroidBackHandler(() => {
    if (expanded) {
      setExpanded(false);
      return true;
    }
    return false;
  });

  // Bottom-sheet drag handling (only on the sheet and drag handle, NOT the page background)
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const hasMoved = useRef(false);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartTime.current = Date.now();
    hasMoved.current = false;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartY.current;
    if (Math.abs(delta) > 4) {
      hasMoved.current = true;
    }

    if (!expanded) {
      // Collapsed: dragging up (delta < 0) is natural; down has high resistance
      if (delta < 0) {
        setDragOffset(delta);
      } else {
        setDragOffset(delta * 0.15);
      }
    } else {
      // Expanded: dragging down (delta > 0) is natural; up has high resistance
      if (delta > 0) {
        setDragOffset(delta);
      } else {
        setDragOffset(delta * 0.15);
      }
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const delta = dragOffset;
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = Math.abs(delta) / Math.max(elapsed, 1);

    if (!expanded) {
      // Dragged up by > 45px or fast flick upward
      if (delta < -45 || (delta < -20 && velocity > 0.35)) {
        setExpanded(true);
      }
    } else {
      // Dragged down by > 50px or fast flick downward
      if (delta > 50 || (delta > 20 && velocity > 0.35)) {
        setExpanded(false);
      }
    }
    setDragOffset(0);
  };

  const getSheetTransform = () => {
    if (isDragging) {
      if (!expanded) {
        return `translateY(${Math.min(0, dragOffset)}px)`;
      } else {
        return `translateY(${Math.max(0, dragOffset)}px)`;
      }
    }
    return undefined;
  };

  const openAuth = (selectedRole: "student" | "employer", selectedTab: "login" | "register") => {
    setRole(selectedRole);
    setTab(selectedTab);
    setExpanded(true);
    setNeedsLinkedIn(false);
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsLinkedIn(false);
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: emailOrUser, password, role: "user" }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.code === "linkedin_required") {
        setNeedsLinkedIn(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Login failed");
      toast.success("Welcome back!");

      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      const storedTab = localStorage.getItem("ifind_student_last_tab");
      const target = next
        ? next.replace(":username", data.data?.username ?? "me")
        : (storedTab && storedTab.startsWith(`/user/${data.data?.username}`))
        ? storedTab
        : `/user/${data.data?.username}/overview`;
      router.push(target);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleEmployerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsLinkedIn(false);
    try {
      const res = await fetch(apiUrl("/api/employer/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOrUser, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.code === "linkedin_required") {
        setNeedsLinkedIn(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Login failed");
      toast.success("Welcome back!");

      const storedTab = localStorage.getItem("ifind_employer_last_tab");
      const target = storedTab && storedTab.startsWith("/employer/") ? storedTab : "/employer/institutes";
      router.push(target);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      toast.success("Account created!");
      router.push(`/user/${username}/overview`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmployerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/employer/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      toast.success("Employer account created!");
      router.push("/employer/institutes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-dvh flex flex-col bg-[var(--bg)] text-[var(--text)] select-none font-sans relative overflow-x-hidden">
      {/* ── Top Header (100% width, with app ThemeSwitcher) ─────────────── */}
      <header className="w-full h-14 shrink-0 px-4 sm:px-8 border-b-2 border-[var(--rule)] bg-[var(--surface)] flex items-center justify-between z-20">
        <div className="flex items-center shrink-0 pointer-events-none select-none" aria-label="iFind">
          <Logo size="md" />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAuth(role === "student" ? "employer" : "student", "login")}
            className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-bg)] border border-[var(--primary)] px-3 py-1 rounded-[var(--radius-xl)] hover:bg-[var(--primary)] hover:text-white transition-colors"
          >
            {role === "student" ? "Employer ?" : "Student ?"}
          </button>
          <ThemeSwitcher compact className="w-24 shrink-0" />
        </div>
      </header>

      {/* ── Scrollable Body Content (Hero + Branding + CTA buttons) ─────── */}
      <main className="w-full flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-start">
        {/* Edge-to-edge image with graduate student holding laptop & Google offer */}
        <div className="w-full h-[26vh] min-h-[200px] max-h-[270px] relative overflow-hidden bg-[var(--surface-3)] shrink-0">
          <Image
            src="/hero-student.png"
            alt="Graduate student with laptop and offer notification"
            fill
            className="object-cover object-top"
            priority
          />
          {/* Subtle bottom fade matching background perfectly */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/80 to-transparent pointer-events-none" />
        </div>

        {/* Hero Branding Content */}
        <div className="w-full max-w-2xl mx-auto px-5 sm:px-8 -mt-8 sm:-mt-10 relative z-10 space-y-4 sm:space-y-5 pb-44 sm:pb-48">
          {/* Big iFind Logo */}
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-clean.svg" alt="iFind" className="h-16 sm:h-20 md:h-24 w-auto logo-art-light drop-shadow-md" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-clean-dark.svg" alt="iFind" className="h-16 sm:h-20 md:h-24 w-auto logo-art-dark drop-shadow-md" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[var(--heading)] tracking-tight leading-[1.14]">
              Your skills. Real opportunities. A brighter future.
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-[var(--text-2)] leading-relaxed max-w-xl font-normal">
              Find verified internships, connect with industry hiring teams, and launch your career in tech.
            </p>
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="pill text-[11px] sm:text-xs font-mono py-1 px-3">⚡ 1,200+ Active Roles</span>
            <span className="pill text-[11px] sm:text-xs font-mono py-1 px-3">✓ Verified Companies</span>
            <span className="pill text-[11px] sm:text-xs font-mono py-1 px-3">💼 Paid Stipends</span>
          </div>

          {/* Action buttons */}
          <div className="pt-1.5 flex flex-wrap items-center gap-3">
            <Link
              href="/internships"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white text-xs sm:text-sm font-bold hover:bg-[var(--primary-dk)] transition-colors shadow-md group"
            >
              <span>Browse internships</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <button
              type="button"
              onClick={() => openAuth("employer", "login")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-[var(--primary)] bg-[var(--primary-bg)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-xs sm:text-sm font-bold font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              Employer ?
            </button>
          </div>
        </div>
      </main>

      {/* ── Dim Backdrop when Bottom Sheet is expanded ──────────────────── */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 transition-opacity"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Draggable Bottom Sheet Card (100% width edge-to-edge) ─────────── */}
      <div
        style={getSheetTransform() ? { transform: getSheetTransform() } : undefined}
        className={`fixed inset-x-0 bottom-0 w-full z-40 bg-[var(--surface)] border-t-2 border-[var(--rule)] rounded-t-[var(--radius-2xl)] sm:rounded-t-[var(--radius-3xl)] shadow-[var(--shadow-lg)] ${
          isDragging ? "" : "transition-all duration-300 ease-out"
        } flex flex-col ${
          expanded ? "h-[88dvh] sm:h-[82dvh] max-h-[740px]" : "h-[148px] sm:h-[156px]"
        }`}
      >
        {/* Handle Bar & Drag Target */}
        <div
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onTouchCancel={handleDragEnd}
          onClick={() => {
            if (!hasMoved.current) {
              setExpanded((prev) => !prev);
            }
          }}
          className="pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing flex flex-col items-center shrink-0 w-full select-none touch-none"
          aria-label={expanded ? "Drag down to close sign in" : "Drag up to sign in"}
        >
          <div className="w-12 h-1.5 bg-[var(--border-2)] rounded-full hover:bg-[var(--primary)] transition-colors" />
          {!expanded && (
            <p className="text-[10px] sm:text-[11px] font-mono text-[var(--text-3)] mt-1.5 font-medium flex items-center gap-1">
              <span>Drag up or tap to sign in</span>
            </p>
          )}
        </div>

        {/* ── Collapsed Content (Register / Login quick buttons) ───────────── */}
        {!expanded ? (
          <div className="w-full max-w-xl mx-auto flex-1 px-5 sm:px-8 pb-3.5 pt-0.5 flex flex-col justify-center gap-2.5">
            <button
              type="button"
              onClick={() => openAuth("student", "register")}
              className="w-full py-2.5 rounded-[var(--radius-sm)] border-2 border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-bg)] hover:bg-[var(--primary)] hover:text-white font-bold font-mono uppercase tracking-wider text-xs transition-all shadow-xs active:scale-98 cursor-pointer"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => openAuth("student", "login")}
              className="w-full py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] text-white hover:bg-[var(--primary-dk)] font-bold font-mono uppercase tracking-wider text-xs transition-all shadow-sm active:scale-98 cursor-pointer"
            >
              Login
            </button>
          </div>
        ) : (
          /* ── Expanded Content (Full Sign In / Register Form) ────────────── */
          <div className="w-full max-w-xl mx-auto flex-1 overflow-y-auto px-5 sm:px-8 pb-8 pt-0.5 flex flex-col">
            {/* Header row in sheet (draggable down to collapse) */}
            <div
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
              onTouchCancel={handleDragEnd}
              className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)] shrink-0 touch-none cursor-grab"
            >
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] text-[var(--primary)]">
                  {role === "student" ? <GraduationCap className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                </span>
                <h2 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wide text-[var(--heading)]">
                  {role === "student" ? "STUDENT" : "EMPLOYER"} {tab === "login" ? "SIGN IN" : "REGISTER"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRole(role === "student" ? "employer" : "student")}
                  className="text-[11px] font-mono font-bold uppercase text-[var(--primary)] hover:underline"
                >
                  Switch to {role === "student" ? "Employer" : "Student"}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="p-1.5 text-[var(--text-3)] hover:text-[var(--heading)] rounded-[var(--radius-sm)]"
                  aria-label="Collapse"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Segment Tab Toggle */}
            <div className="grid grid-cols-2 p-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] mb-3 text-xs font-bold font-mono uppercase tracking-wider shrink-0">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`py-2 rounded-[var(--radius-sm)] transition-all ${
                  tab === "login"
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "text-[var(--text-2)] hover:text-[var(--heading)]"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setTab("register")}
                className={`py-2 rounded-[var(--radius-sm)] transition-all ${
                  tab === "register"
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "text-[var(--text-2)] hover:text-[var(--heading)]"
                }`}
              >
                Register
              </button>
            </div>

            {/* LinkedIn required banner */}
            {needsLinkedIn && (
              <div role="alert" className="mb-3 rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-2.5 text-xs text-[var(--danger)]">
                <p className="font-semibold">Sign in with LinkedIn required.</p>
                <p className="mt-0.5 text-[var(--text-2)]">Accounts with both password and LinkedIn must authenticate via LinkedIn once a month. Use LinkedIn below.</p>
              </div>
            )}

            {/* Forms */}
            {tab === "login" ? (
              <form onSubmit={role === "student" ? handleStudentLogin : handleEmployerLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    {role === "student" ? "Email or Username" : "Work Email"}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-[var(--text-3)] pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type={role === "student" ? "text" : "email"}
                      required
                      value={emailOrUser}
                      onChange={(e) => setEmailOrUser(e.target.value)}
                      placeholder={role === "student" ? "student@example.com or username" : "employer@company.com"}
                      className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-hidden focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-[var(--text-3)] pointer-events-none">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2.5 pl-9 pr-10 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-hidden focus:border-[var(--primary)] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-[var(--text-3)] hover:text-[var(--text)]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-dk)] text-white font-bold font-mono uppercase tracking-wider text-xs transition-colors shadow-sm active:scale-98 disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>

                <div className="flex items-center gap-3 my-2.5 text-xs text-[var(--text-3)]">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span>or continue with</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>

                <LinkedInButton as={role === "employer" ? "employer" : undefined} />
              </form>
            ) : (
              <form onSubmit={role === "student" ? handleStudentRegister : handleEmployerRegister} className="space-y-2.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Full Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-[var(--text-3)] pointer-events-none">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2 pl-9 pr-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-hidden focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                {role === "student" && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="lowercase_username"
                      className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2 px-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-hidden focus:border-[var(--primary)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2 px-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-hidden focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] py-2 px-3 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-hidden focus:border-[var(--primary)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-[var(--radius-sm)] bg-[var(--primary)] hover:bg-[var(--primary-dk)] text-white font-bold font-mono uppercase tracking-wider text-xs transition-colors shadow-sm active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Creating account…" : "Create Account"}
                </button>

                <div className="flex items-center gap-3 my-2 text-xs text-[var(--text-3)]">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>

                <LinkedInButton as={role === "employer" ? "employer" : undefined} text="Sign up with LinkedIn" />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
