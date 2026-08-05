"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ResumeTab }      from "@/components/dashboard/ResumeTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function ResumePage() {
  const { data, error } = useStudentDashboard();
  if (!data) return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{error ?? "Loading resume…"}</main>;
  return (
    <DashboardShell activeTab="resume" user={data.user}>
      <ResumeTab user={data.user} />
    </DashboardShell>
  );
}
