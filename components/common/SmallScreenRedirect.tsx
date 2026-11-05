"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSmallScreen } from "@/lib/isSmallScreen";

/**
 * Client component that immediately redirects smaller screen viewports (< 1024px)
 * or mobile/native devices to the mobile landing page (/phone).
 */
export function SmallScreenRedirect({ to = "/phone" }: { to?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (isSmallScreen()) {
      router.replace(to);
    }
  }, [router, to]);

  return null;
}
