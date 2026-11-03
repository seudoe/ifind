import { Badge } from "@/components/ui/Badge";
import type { CampusApplicationStatus } from "@/types/campus";

export const CAMPUS_STATUS_LABEL: Record<CampusApplicationStatus, string> = {
    applied: "Applied", shortlisted: "Shortlisted", in_process: "In process", offered: "Offered", accepted: "Accepted",
    declined: "Declined", rejected: "Not taken forward", withdrawn: "Withdrawn", removed: "Removed",
};

const VARIANT: Record<CampusApplicationStatus, "default" | "secondary" | "success" | "warning" | "danger" | "outline"> = {
    applied: "secondary", shortlisted: "default", in_process: "warning", offered: "warning", accepted: "success",
    declined: "outline", rejected: "danger", withdrawn: "outline", removed: "danger",
};

export function CampusApplicationPill({ status }: { status: CampusApplicationStatus }) {
    return <Badge variant={VARIANT[status]}>{CAMPUS_STATUS_LABEL[status]}</Badge>;
}
