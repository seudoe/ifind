"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";


type Status = "idle" | "processing" | "completed" | "failed";

export function VectorizationProgressBar() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial fetch
    checkStatus();

    // Set up polling
    pollIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/user/vectorization-status");
      
      // Stop polling if user is not authenticated
      if (res.status === 401) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        return;
      }
      
      if (!res.ok) return;
      
      const data = await res.json();
      if (!data.success) return;

      const currentStatus = data.status as Status;
      
      setStatus((prev) => {
        // If we transitioned from processing to completed, trigger refresh
        if (prev === "processing" && currentStatus === "completed") {
          router.refresh(); // Refresh current route to fetch new recommendations
        }
        return currentStatus;
      });

    } catch (err) {
      console.error("Failed to fetch vectorization status", err);
    }
  };

  useEffect(() => {
    if (status === "processing") {
      // Simulate progress up to 90%
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => (p >= 90 ? 90 : p + Math.random() * 10));
      }, 1000);
      return () => clearInterval(interval);
    } else if (status === "completed") {
      setProgress(100);
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

  if (status === "idle") return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-4 z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        {status === "processing" && (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
        )}
        {status === "completed" && (
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        )}
        {status === "failed" && (
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
        )}
        
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text)]">
            {status === "processing" && "Analyzing profile & matches..."}
            {status === "completed" && "Recommendations updated!"}
            {status === "failed" && "Analysis failed."}
          </p>
        </div>
      </div>

      <div className="w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            status === "completed" ? "bg-green-500" : 
            status === "failed" ? "bg-red-500" : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
