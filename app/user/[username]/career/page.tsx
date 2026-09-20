import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CareerAssistantTab } from "@/components/dashboard/CareerAssistantTab";

export default function CareerPage() {
  return (
    <DashboardShell activeTab="career">
      <CareerAssistantTab />
    </DashboardShell>
  );
}
