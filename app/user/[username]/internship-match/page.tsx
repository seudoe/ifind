"use client";

import { JobMatchTab } from "@/components/dashboard/JobMatchTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function JobMatchPage() {
  const { data, error } = useStudentDashboard();
  
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-[var(--text-3)]">
        {error ?? "Loading..."}
      </main>
    );
  }

  return (
    <>
      <JobMatchTab />
    </>
  );
}
