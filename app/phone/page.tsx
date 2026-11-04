"use client";

import { useEffect, useRef, useState } from "react";
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
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { safeNextPath } from "@/lib/authRedirect";

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

  // Gesture handling
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY < -40 && !expanded) {
      // Swiped upwards
      setExpanded(true);
    } else if (deltaY > 50 && expanded) {
      // Swiped downwards
      setExpanded(false);
    }
    touchStartY.current = null;
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
      const res = await fetch("/api/auth/login", {
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
      const res = await fetch("/api/employer/auth/login", {
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
      const res = await fetch("/api/auth/register", {
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
      const res = await fetch("/api/employer/auth/register", {
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
    <div
      className="h-dvh max-w-md mx-auto relative overflow-hidden bg-zinc-950 text-white flex flex-col justify-between select-none font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Background & Ambient Glow ───────────────────────────────────────── */}
      <div className="absolute inset-0 bg-radial from-emerald-950/20 via-zinc-950 to-black pointer-events-none" />

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 px-6 pt-5 pb-3 flex items-center justify-between">
        <Logo size="md" />
        <button
          onClick={() => openAuth(role === "student" ? "employer" : "student", "login")}
          className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-full hover:bg-emerald-900/50 transition-colors"
        >
          {role === "student" ? "Employer ?" : "Student ?"}
        </button>
      </header>

      {/* ── Middle Landing Card (Hero) ─────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-20">
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-2xl">
          {/* Hero Graduate Image with Overlay */}
          <div className="relative h-56 rounded-xl overflow-hidden mb-4 bg-zinc-900">
            <Image
              src="/hero-graduate.png"
              alt="Graduate receiving offer"
              fill
              className="object-cover object-top opacity-90"
              priority
            />
            {/* Offer badge overlay */}
            <div className="absolute top-3 right-3 bg-white/95 text-zinc-900 rounded-lg p-2 shadow-lg backdrop-blur-xs flex items-center gap-2 text-left">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                ✓
              </div>
              <div>
                <p className="text-[10px] font-bold leading-none">Offer Received</p>
                <p className="text-[9px] text-zinc-500 leading-tight">Software Engineer Intern</p>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            <span className="text-emerald-400">i</span>Find
          </h1>
          <p className="text-sm font-medium text-zinc-300 leading-snug">
            Your skills. Real opportunities. A brighter future.
          </p>

          <div className="mt-4 flex items-center justify-between">
            <Link
              href="/internships"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors group"
            >
              Browse internships <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <button
              onClick={() => openAuth("employer", "login")}
              className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 rounded-full transition-all"
            >
              Employer ?
            </button>
          </div>
        </div>
      </div>

      {/* ── Swipable Bottom Sheet Card ─────────────────────────────────────── */}
      <div
        className={`fixed inset-x-0 bottom-0 max-w-md mx-auto z-40 bg-zinc-900 border-t border-zinc-700/80 rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.85)] transition-all duration-300 ease-out flex flex-col ${
          expanded ? "h-[85dvh]" : "h-48"
        }`}
      >
        {/* Handle Bar & Drag Touch Target */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="pt-3 pb-2 cursor-pointer flex flex-col items-center shrink-0"
        >
          <div className="w-12 h-1.5 bg-zinc-600 rounded-full" />
          {!expanded && (
            <p className="text-[11px] font-mono text-zinc-400 mt-2 font-medium">
              Swipe up to sign in
            </p>
          )}
        </div>

        {/* ── Collapsed Content: Big Register & Login Buttons ──────────────── */}
        {!expanded ? (
          <div className="flex-1 px-6 pb-6 pt-1 flex flex-col justify-center gap-3">
            <button
              onClick={() => openAuth("student", "register")}
              className="w-full py-3.5 rounded-xl border-2 border-emerald-500 text-emerald-400 font-bold uppercase tracking-wider text-sm hover:bg-emerald-500 hover:text-zinc-950 transition-colors shadow-lg active:scale-98"
            >
              Register
            </button>
            <button
              onClick={() => openAuth("student", "login")}
              className="w-full py-3.5 rounded-xl bg-zinc-800 text-white font-bold uppercase tracking-wider text-sm hover:bg-zinc-700 transition-colors shadow-md active:scale-98"
            >
              Login
            </button>
          </div>
        ) : (
          /* ── Expanded Content: Full Sign In / Register Form ───────────────── */
          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2 flex flex-col">
            {/* Header row in sheet */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {role === "student" ? <GraduationCap className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                </span>
                <div>
                  <h2 className="text-base font-bold uppercase tracking-wide text-white">
                    {role === "student" ? "STUDENT" : "EMPLOYER"} {tab === "login" ? "SIGN IN" : "REGISTER"}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRole(role === "student" ? "employer" : "student")}
                  className="text-[11px] font-mono font-medium text-zinc-400 hover:text-emerald-400 underline underline-offset-2"
                >
                  {role === "student" ? "Employer?" : "Student?"}
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-md"
                  aria-label="Collapse"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Segment Tab Toggle */}
            <div className="grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl mb-4 text-xs font-bold font-mono uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setTab("login")}
                className={`py-2 rounded-lg transition-all ${
                  tab === "login"
                    ? "bg-emerald-500 text-zinc-950 shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setTab("register")}
                className={`py-2 rounded-lg transition-all ${
                  tab === "register"
                    ? "bg-emerald-500 text-zinc-950 shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Register
              </button>
            </div>

            {/* LinkedIn required banner */}
            {needsLinkedIn && (
              <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-400">
                <p className="font-semibold">Sign in with LinkedIn required.</p>
                <p className="mt-0.5 text-zinc-400">Accounts with both password and LinkedIn must authenticate via LinkedIn once a month. Use LinkedIn below.</p>
              </div>
            )}

            {/* Forms */}
            {tab === "login" ? (
              <form onSubmit={role === "student" ? handleStudentLogin : handleEmployerLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    {role === "student" ? "Email or Username" : "Work Email"}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500 pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type={role === "student" ? "text" : "email"}
                      required
                      value={emailOrUser}
                      onChange={(e) => setEmailOrUser(e.target.value)}
                      placeholder={role === "student" ? "student@example.com or username" : "employer@company.com"}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500 pointer-events-none">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold uppercase tracking-wider text-xs transition-colors shadow-lg active:scale-98 disabled:opacity-50 mt-1"
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>

                <div className="flex items-center gap-3 my-3 text-xs text-zinc-500">
                  <span className="h-px flex-1 bg-zinc-800" />
                  <span>or continue with</span>
                  <span className="h-px flex-1 bg-zinc-800" />
                </div>

                <LinkedInButton as={role === "employer" ? "employer" : undefined} />
              </form>
            ) : (
              <form onSubmit={role === "student" ? handleStudentRegister : handleEmployerRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500 pointer-events-none">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {role === "student" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      placeholder="lowercase_username"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white placeholder-zinc-600 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold uppercase tracking-wider text-xs transition-colors shadow-lg active:scale-98 disabled:opacity-50"
                >
                  {loading ? "Creating account…" : "Create Account"}
                </button>

                <div className="flex items-center gap-3 my-2 text-xs text-zinc-500">
                  <span className="h-px flex-1 bg-zinc-800" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-zinc-800" />
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
