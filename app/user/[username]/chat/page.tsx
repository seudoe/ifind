import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ResumeChatTab } from "@/components/dashboard/ResumeChatTab";

export default function ChatPage() {
  return (
    <DashboardShell activeTab="chat">
      <ResumeChatTab />
    </DashboardShell>
  );
}
