import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_LABEL } from "@/types/student-application";
import type { ApplicationStatus } from "@/types/employer";

const COLORS: Record<ApplicationStatus, string> = {
  applied: "bg-blue-100 text-blue-700",
  under_review: "bg-sky-100 text-sky-700",
  shortlisted: "bg-green-100 text-green-700",
  interview: "bg-amber-100 text-amber-700",
  offered: "bg-teal-100 text-teal-700",
  hired: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

export function ApplicationStatusChip({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", COLORS[status], className)}>
      {APPLICATION_STATUS_LABEL[status]}
    </span>
  );
}
