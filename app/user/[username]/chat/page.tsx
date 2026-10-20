"use client";

import { ResumeChatTab } from "@/components/dashboard/ResumeChatTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function ChatPage() {
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
      <ResumeChatTab />
    </>
  );
}
