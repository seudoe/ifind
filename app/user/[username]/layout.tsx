"use client";

import { useEffect, useState } from "react";
import { StudentProvider, useStudent } from "@/components/student/StudentProvider";
import { StudentShell } from "@/components/student/StudentShell";
import { LinkedInReviewDialog } from "@/components/student/LinkedInReviewDialog";

type Notice = { kind: "error" | "ok"; text: string } | null;

/** OAuth round-trips (LinkedIn connect) report back through ?error= / ?linked=1; shown inline so no toaster timing can hide it. */
function readNotice(): Notice {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const err = q.get("error");
  if (err) return { kind: "error", text: err };
  if (q.get("linked") === "1") return { kind: "ok", text: "LinkedIn connected." };
  return null;
}

function Gate({ children }: { children: React.ReactNode }) {
  const { data, error } = useStudent();
  const [notice, setNotice] = useState<Notice>(readNotice);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("error") || q.has("linked")) {
      q.delete("error"); q.delete("linked");
      window.history.replaceState(null, "", window.location.pathname + (q.size ? `?${q}` : ""));
    }
  }, []);
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">
        {error ?? "Loading your dashboard…"}
      </main>
    );
  }
  return (
    <StudentShell user={data.user}>
      {notice && (
        <div role="alert" className={`mx-4 mt-4 flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border p-3 text-sm md:mx-6 ${notice.kind === "error" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--primary)] text-[var(--primary)]"}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}
      {children}
      <LinkedInReviewDialog user={data.user} />
    </StudentShell>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <Gate>{children}</Gate>
    </StudentProvider>
  );
}
