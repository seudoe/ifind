import { Badge } from "@/components/ui/Badge";
import type { ApplicationStatus, InternshipStatus } from "@/types/employer";
import type { Moderation } from "@/types/internship";

const STATUS_VARIANT: Record<InternshipStatus, "secondary" | "success" | "warning" | "danger" | "outline"> = {
    draft: "secondary", published: "success", paused: "warning", closed: "danger", archived: "outline",
};
const MOD_VARIANT: Record<Moderation["status"], "success" | "warning" | "danger"> = {
    auto_approved: "success", manually_approved: "success", pending_review: "warning",
    auto_rejected: "danger", manually_rejected: "danger",
};
const MOD_LABEL: Record<Moderation["status"], string> = {
    auto_approved: "Approved", manually_approved: "Approved", pending_review: "In review",
    auto_rejected: "Rejected", manually_rejected: "Rejected",
};

export function StatusPill({ status }: { status: InternshipStatus }) {
    return <Badge variant={STATUS_VARIANT[status]} className="capitalize">{status}</Badge>;
}

export function ModerationPill({ status }: { status: Moderation["status"] }) {
    return <Badge variant={MOD_VARIANT[status]}>{MOD_LABEL[status]}</Badge>;
}

const APP_VARIANT: Record<ApplicationStatus, "default" | "secondary" | "success" | "warning" | "danger" | "outline"> = {
    applied: "secondary", under_review: "default", shortlisted: "default", interview: "warning",
    offered: "warning", hired: "success", rejected: "danger", withdrawn: "outline",
};

export const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
    applied: "Applied", under_review: "Under review", shortlisted: "Shortlisted", interview: "Interview",
    offered: "Offered", hired: "Hired", rejected: "Rejected", withdrawn: "Withdrawn",
};

export function ApplicationStatusPill({ status }: { status: ApplicationStatus }) {
    return <Badge variant={APP_VARIANT[status]}>{APP_STATUS_LABEL[status]}</Badge>;
}
