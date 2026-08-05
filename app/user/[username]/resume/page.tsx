import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ResumeTab }      from "@/components/dashboard/ResumeTab";

export default function ResumePage() {
  return (
    <DashboardShell activeTab="resume">
      <ResumeTab />
    </DashboardShell>
  );
}
