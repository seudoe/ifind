"use client";

import { SavedTab }       from "@/components/dashboard/SavedTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function SavedPage() {
  const { data, error } = useStudentDashboard();
  if (!data) return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{error ?? "Loading saved internships…"}</main>;
  return (
    <>
      <SavedTab internships={data.saved} user={data.user} />
    </>
  );
}
