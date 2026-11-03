"use client";

import { StudentProvider, useStudent } from "@/components/student/StudentProvider";
import { StudentShell } from "@/components/student/StudentShell";
import { LinkedInReviewDialog } from "@/components/student/LinkedInReviewDialog";

function Gate({ children }: { children: React.ReactNode }) {
  const { data, error } = useStudent();
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
