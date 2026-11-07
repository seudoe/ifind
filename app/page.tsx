"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSmallScreen } from "@/lib/isSmallScreen";
import { apiUrl } from "@/lib/apiOrigin";
import { checkAuthData, saveMobileSession, clearMobileSession } from "@/lib/mobileAuth";
import { Logo } from "@/components/ui/Logo";

/**
 * Root index page / App Launch Auth Checker.
 *
 * Rules:
 *   1. Check device storage auth data (JWT token, username, portal).
 *      - If found and valid: immediately resume the dashboard (no login screen!).
 *   2. If no device token, check session cookies against /api/auth/me.
 *      - If cookie exists: save to device storage and resume dashboard.
 *   3. If genuinely logged out:
 *      - Small screens / mobile APK -> /phone (swipe-up landing)
 *      - Large desktop browsers -> /user (marketing landing)
 */
export default function RootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAuthAndRoute() {
      // Step 1: Check device storage auth data
      const check = checkAuthData();
      if (check.hasData && check.targetTab) {
        // Fast path: Token exists in flash storage
        router.replace(check.targetTab);

        // Verify asynchronously in background to sync fresh user data
        try {
          const endpoint = check.role === "employer" ? "/api/employer/auth/me" : "/api/auth/me";
          const res = await fetch(apiUrl(endpoint), { credentials: "include" });
          if (!res.ok && res.status === 401) {
            clearMobileSession();
            if (!cancelled) router.replace("/phone");
          }
        } catch {
          // Network errors or offline mode: keep the session active
        }
        return;
      }

      // Step 2: Fall back to checking session cookies (e.g. web browser / fresh app install)
      try {
        const lastPortal = typeof window !== "undefined" ? localStorage.getItem("ifind_last_active_portal") : null;
        const studentTab = typeof window !== "undefined" ? localStorage.getItem("ifind_student_last_tab") : null;
        const employerTab = typeof window !== "undefined" ? localStorage.getItem("ifind_employer_last_tab") : null;

        // Check employer first if employer was the last active portal
        if (lastPortal === "employer") {
          const empRes = await fetch(apiUrl("/api/employer/auth/me"), { credentials: "include" });
          if (empRes.ok) {
            const body = await empRes.json();
            if (body.data?.id || body.data?.email) {
              const target = employerTab && employerTab.startsWith("/employer/") ? employerTab : "/employer/institutes";
              if (!cancelled) router.replace(target);
              return;
            }
          }
        }

        // Check student auth
        const stuRes = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
        if (stuRes.ok) {
          const body = await stuRes.json();
          if (body.data?.username) {
            const username = body.data.username;
            const target = studentTab && studentTab.startsWith(`/user/${username}`)
              ? studentTab
              : `/user/${username}/overview`;
            if (!cancelled) router.replace(target);
            return;
          }
        }

        // Check employer if not already checked
        if (lastPortal !== "employer") {
          const empRes = await fetch(apiUrl("/api/employer/auth/me"), { credentials: "include" });
          if (empRes.ok) {
            const body = await empRes.json();
            if (body.data?.id || body.data?.email) {
              const target = employerTab && employerTab.startsWith("/employer/") ? employerTab : "/employer/institutes";
              if (!cancelled) router.replace(target);
              return;
            }
          }
        }
      } catch {
        // network error / offline
      }

      // Step 3: Truly unauthenticated -> route to login landing
      if (!cancelled) {
        setChecking(false);
        if (isSmallScreen()) {
          router.replace("/phone");
        } else {
          router.replace("/user");
        }
      }
    }

    checkAuthAndRoute();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <Logo size="lg" onDark />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
          Resuming your session…
        </p>
      </div>
    </div>
  );
}
