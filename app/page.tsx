"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Root index page.
 *
 * Rules:
 *   If logged in:
 *     - Check localStorage (where the user last left off)
 *     - If student tab saved -> route to that student tab (or overview)
 *     - If employer tab saved -> route to that employer tab (or institutes)
 *   If logged out:
 *     - On mobile / Capacitor app: /phone (mobile swipe-up landing)
 *     - On desktop browser: /user (web landing page)
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function determineRoute() {
      const lastPortal = typeof window !== "undefined" ? localStorage.getItem("ifind_last_active_portal") : null;
      const studentTab = typeof window !== "undefined" ? localStorage.getItem("ifind_student_last_tab") : null;
      const employerTab = typeof window !== "undefined" ? localStorage.getItem("ifind_employer_last_tab") : null;

      // 1. If employer was active portal, check employer auth first
      if (lastPortal === "employer") {
        try {
          const res = await fetch("/api/employer/auth/me", { credentials: "include" });
          if (res.ok) {
            const body = await res.json();
            if (body.data?.id || body.data?.email) {
              const target = employerTab && employerTab.startsWith("/employer/") ? employerTab : "/employer/institutes";
              router.replace(target);
              return;
            }
          }
        } catch {
          // network error / offline -> fallback
        }
      }

      // 2. Check student auth
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const body = await res.json();
          if (body.data?.username) {
            const target = studentTab && studentTab.startsWith(`/user/${body.data.username}`)
              ? studentTab
              : `/user/${body.data.username}/overview`;
            router.replace(target);
            return;
          }
        }
      } catch {
        // network error / offline -> fallback
      }

      // 3. If employer wasn't checked yet, check it now
      if (lastPortal !== "employer") {
        try {
          const res = await fetch("/api/employer/auth/me", { credentials: "include" });
          if (res.ok) {
            const body = await res.json();
            if (body.data?.id || body.data?.email) {
              const target = employerTab && employerTab.startsWith("/employer/") ? employerTab : "/employer/institutes";
              router.replace(target);
              return;
            }
          }
        } catch {
          // network error / offline -> fallback
        }
      }

      // 4. Logged out:
      // Mobile / Capacitor app starts at /phone; desktop web starts at /user
      const isMobile =
        (typeof window !== "undefined" && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
        (typeof window !== "undefined" && window.innerWidth <= 768) ||
        (typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Capacitor/i.test(navigator.userAgent));

      if (isMobile) {
        router.replace("/phone");
      } else {
        router.replace("/user");
      }
    }

    determineRoute();
  }, [router]);

  return null;
}
