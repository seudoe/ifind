import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BrowseTab }      from "@/components/dashboard/BrowseTab";

export default function BrowsePage() {
  return (
    <DashboardShell activeTab="browse">
      <BrowseTab />
    </DashboardShell>
  );
}
