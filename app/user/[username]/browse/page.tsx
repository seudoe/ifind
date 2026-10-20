"use client";

import { BrowseTab } from "@/components/dashboard/BrowseTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function BrowsePage() {
  const { data, error } = useStudentDashboard();

  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">
        {error ?? "Loading internships…"}
      </main>
    );
  }

  return <BrowseTab internships={data.browse} user={data.user} />;
}
