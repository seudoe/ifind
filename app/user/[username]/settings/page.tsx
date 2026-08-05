"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SettingsTab }    from "@/components/dashboard/SettingsTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function SettingsPage() {
  const { data, error } = useStudentDashboard();
  if (!data) return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{error ?? "Loading settings…"}</main>;
  return (
    <DashboardShell activeTab="settings" user={data.user}>
      <SettingsTab user={data.user} />
    </DashboardShell>
  );
}
