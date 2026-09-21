"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CareerAssistantTab } from "@/components/dashboard/CareerAssistantTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function CareerPage() {
  const { data, error } = useStudentDashboard();
  
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-gray-500">
        {error ?? "Loading..."}
      </main>
    );
  }

  return (
    <DashboardShell activeTab="career" user={data.user}>
      <CareerAssistantTab />
    </DashboardShell>
  );
}
