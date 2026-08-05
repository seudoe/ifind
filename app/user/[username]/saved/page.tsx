"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SavedTab }       from "@/components/dashboard/SavedTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function SavedPage() {
  const { data, error } = useStudentDashboard();
  if (!data) return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{error ?? "Loading saved internships…"}</main>;
  return (
    <DashboardShell activeTab="saved" user={data.user}>
      <SavedTab internships={data.saved} user={data.user} />
    </DashboardShell>
  );
}
