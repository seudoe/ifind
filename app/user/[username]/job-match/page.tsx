"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { JobMatchTab } from "@/components/dashboard/JobMatchTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function JobMatchPage() {
  const { data, error } = useStudentDashboard();
  
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-gray-500">
        {error ?? "Loading..."}
      </main>
    );
  }

  return (
    <DashboardShell activeTab="job-match" user={data.user}>
      <JobMatchTab />
    </DashboardShell>
  );
}
