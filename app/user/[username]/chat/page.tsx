"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ResumeChatTab } from "@/components/dashboard/ResumeChatTab";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

export default function ChatPage() {
  const { data, error } = useStudentDashboard();
  
  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-gray-500">
        {error ?? "Loading..."}
      </main>
    );
  }

  return (
    <DashboardShell activeTab="chat" user={data.user}>
      <ResumeChatTab />
    </DashboardShell>
  );
}
