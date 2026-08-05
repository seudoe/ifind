import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SettingsTab }    from "@/components/dashboard/SettingsTab";

export default function SettingsPage() {
  return (
    <DashboardShell activeTab="settings">
      <SettingsTab />
    </DashboardShell>
  );
}
