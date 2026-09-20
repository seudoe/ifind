import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { JobMatchTab } from "@/components/dashboard/JobMatchTab";

export default function JobMatchPage() {
  return (
    <DashboardShell activeTab="job-match">
      <JobMatchTab />
    </DashboardShell>
  );
}
