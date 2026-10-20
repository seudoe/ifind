"use client";

import { CareerAssistantTab } from "@/components/dashboard/CareerAssistantTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function CareerPage() {
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
      <CareerAssistantTab />
    </>
  );
}
