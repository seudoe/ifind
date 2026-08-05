import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SavedTab }       from "@/components/dashboard/SavedTab";

export default function SavedPage() {
  return (
    <DashboardShell activeTab="saved">
      <SavedTab />
    </DashboardShell>
  );
}
