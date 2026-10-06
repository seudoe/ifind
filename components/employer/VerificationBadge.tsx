import { Badge } from "@/components/ui/Badge";
import type { VerificationStatus } from "@/types/employer";

const MAP: Record<VerificationStatus, { label: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
    verified: { label: "Verified", variant: "success" },
    pending: { label: "Pending verification", variant: "warning" },
    rejected: { label: "Verification rejected", variant: "danger" },
    unverified: { label: "Unverified", variant: "secondary" },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
    const { label, variant } = MAP[status];
    return <Badge variant={variant}>{label}</Badge>;
}
