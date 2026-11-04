"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { StudentProvider, useStudent } from "@/components/student/StudentProvider";
import { StudentShell } from "@/components/student/StudentShell";
import { LinkedInReviewDialog } from "@/components/student/LinkedInReviewDialog";

function Gate({ children }: { children: React.ReactNode }) {
  const { data, error } = useStudent();
  // OAuth round-trips (LinkedIn connect) report back through ?error= / ?linked=1
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("error");
    if (err) toast.error(err, { duration: 8000 });
    else if (q.get("linked") === "1") toast.success("LinkedIn connected");
    if (err || q.get("linked")) { q.delete("error"); q.delete("linked"); window.history.replaceState(null, "", window.location.pathname + (q.size ? `?${q}` : "")); }
  }, []);
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">
        {error ?? "Loading your dashboard…"}
      </main>
    );
  }
  return <StudentShell user={data.user}>{children}<LinkedInReviewDialog user={data.user} /></StudentShell>;
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <Gate>{children}</Gate>
    </StudentProvider>
  );
}
