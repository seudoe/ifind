"use client";

import { useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function OverviewPage() {
  const { data, error } = useStudentDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const username = params?.username as string;

  // On session start, restore last opened tab if user previously had another tab open (e.g. campus)
  useEffect(() => {
    if (typeof window === "undefined" || !username) return;
    if (sessionStorage.getItem("ifind_student_resumed") === "true") return;
    sessionStorage.setItem("ifind_student_resumed", "true");

    const stored = localStorage.getItem("ifind_student_last_tab");
    if (stored && stored.startsWith(`/user/${username}/`) && stored !== pathname) {
      router.replace(stored);
    }
  }, [username, pathname, router]);

  if (!data) return <StudentState message={error ?? "Loading your dashboard…"} />;
  return (
    <>
      <OverviewTab user={data.user} recommended={data.recommended} applications={data.applied} />
    </>
  );
}

function StudentState({ message }: { message: string }) {
  return <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">{message}</main>;
}
