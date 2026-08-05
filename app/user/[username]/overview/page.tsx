import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OverviewTab }    from "@/components/dashboard/OverviewTab";

export default function OverviewPage() {
  return (
    <DashboardShell activeTab="overview">
      <OverviewTab />
    </DashboardShell>
  );
}
