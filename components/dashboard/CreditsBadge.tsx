"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface Credits {
  limit: number;
  remaining: number;
  resetsAt: string;
}

/** Tell the badge to re-read today's credits (call after a billed request finishes). */
export function refreshCredits() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("credits:refresh"));
}

/** "N AI credits left today" for the billed features. Refreshes after each request, on focus, and every 30s. */
export function CreditsBadge({ className = "" }: { className?: string }) {
  const [credits, setCredits] = useState<Credits | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/usage/me", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data) setCredits(json.data);
      } catch {
        // The badge is informational; stay quiet if it can't load.
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    window.addEventListener("credits:refresh", load);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("credits:refresh", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  if (!credits) return null;
  const low = credits.remaining <= Math.max(2, Math.floor(credits.limit * 0.1));
  return (
    <span
      title="AI credits reset every day at 12:00 AM IST"
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
        credits.remaining === 0
          ? "border-red-200 bg-red-50 text-red-700"
          : low
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-gray-200 bg-gray-50 text-gray-600"
      } ${className}`}
    >
      <Zap className="h-3 w-3" />
      {credits.remaining} of {credits.limit} AI credits left today
    </span>
  );
}
