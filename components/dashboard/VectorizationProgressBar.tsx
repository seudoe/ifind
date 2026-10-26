"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { RECOMMENDATION_RUN, RECOMMENDATIONS_UPDATED } from "@/lib/recommendationProgress";


type Status = "idle" | "processing" | "completed" | "failed";

export function VectorizationProgressBar() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  // Not relevant on the landing page or the moderator area.
  const hidden = pathname === "/" || pathname.startsWith("/moderator");
  // "completed" is persisted on the user; only announce it if we watched it finish.
  const sawProcessing = useRef(false);
  const announced = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fastUntil = useRef(0);

  useEffect(() => {
    // Slow background check (a run started in another tab or before a reload); fast while a save has just announced one
    checkStatus();
    const tick = () => {
      checkStatus();
      pollIntervalRef.current = setTimeout(tick, Date.now() < fastUntil.current ? 1000 : 10000);
    };
    pollIntervalRef.current = setTimeout(tick, 10000);

    const onRun = () => {
      // The save returns after the server has marked the run "processing", so one immediate check shows the card
      fastUntil.current = Date.now() + 120_000;
      sawProcessing.current = false;
      announced.current = false;
      checkStatus();
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = setTimeout(tick, 1000);
    };
    window.addEventListener(RECOMMENDATION_RUN, onRun);

    return () => {
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current);
      window.removeEventListener(RECOMMENDATION_RUN, onRun);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/user/vectorization-status");
      
      // Stop polling if user is not authenticated
      if (res.status === 401) {
        if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
        return;
      }
      
      if (!res.ok) return;
      
      const data = await res.json();
      if (!data.success) return;

      let currentStatus = data.status as Status;
      if (currentStatus === "processing") {
        sawProcessing.current = true;
        announced.current = false;
      } else if (!sawProcessing.current || announced.current) {
        currentStatus = "idle"; // stale persisted status, or already announced
      } else {
        announced.current = true;
      }

      setStatus(currentStatus);

    } catch (err) {
      console.error("Failed to fetch vectorization status", err);
    }
  };

  useEffect(() => {
    if (status === "processing") {
      // The vectoriser reports no percentage: ease towards 90% and jump to 100% when it says "completed"
      setProgress(5);
      const interval = setInterval(() => {
        setProgress((p) => (p >= 90 ? 90 : p + (90 - p) * 0.12 + 1));
      }, 800);
      return () => clearInterval(interval);
    } else if (status === "completed") {
      setProgress(100);
      router.refresh(); // server-rendered routes
      window.dispatchEvent(new Event(RECOMMENDATIONS_UPDATED)); // student area: reload the dashboard data (new recommendations)
      // Hide after 5 seconds
      const timeout = setTimeout(() => {
        setStatus("idle");
        setProgress(0);
      }, 5000);
      return () => clearTimeout(timeout);
    } else if (status === "failed") {
      const timeout = setTimeout(() => {
        setStatus("idle");
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  if (hidden || status === "idle") return null;

  return (
    <div className="fixed bottom-24 right-6 w-72 bg-[var(--surface)] border border-gray-200 rounded-lg shadow-[var(--shadow-lg)] p-3 z-40 flex flex-col gap-2 animate-in slide-in-from-bottom-3">
      <div className="flex items-center gap-2">
        {status === "processing" && (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
        )}
        {status === "completed" && (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        )}
        {status === "failed" && (
          <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
        )}
        
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-900">
            {status === "processing" && `Updating your recommendations… ${Math.round(progress)}%`}
            {status === "completed" && "Recommendations updated · 100%"}
            {status === "failed" && "Update failed"}
          </p>
        </div>
      </div>

      {(status === "processing" || status === "completed") && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${status === "completed" ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
