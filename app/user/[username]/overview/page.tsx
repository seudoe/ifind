"use client";

import { OverviewTab }    from "@/components/dashboard/OverviewTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function OverviewPage() {
  const { data, error } = useStudentDashboard();
  if (!data) return <StudentState message={error ?? "Loading your dashboard…"} />;
  return (
    <>
      <OverviewTab user={data.user} recommended={data.recommended} applications={data.applied} />
    </>
  );
}

function StudentState({ message }: { message: string }) { return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{message}</main>; }
