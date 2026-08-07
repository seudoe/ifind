"use client";

import { ExternalLink, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ModerationQueueItem } from "@/types/moderator";

interface ModerationQueueCardProps {
    item: ModerationQueueItem;
    onApprove: () => void;
    onReject: () => void;
}

function ScoreBadge({ score }: { score: number | null }) {
    if (score === null) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-3)] text-[var(--text-3)]">
                No score
            </span>
        );
    }

    const colorClass =
        score < 30
            ? "bg-green-100 text-green-700"
            : score <= 70
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700";

    return (
        <span
            className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                colorClass,
            )}
        >
            Score: {score}
        </span>
    );
}

function LinkStatus({ reachable }: { reachable: boolean | null | undefined }) {
    if (reachable === null || reachable === undefined) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-3)]">
                <AlertCircle className="h-3.5 w-3.5" />
                Link unchecked
            </span>
        );
    }
    if (reachable) {
        return (
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Link reachable
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <XCircle className="h-3.5 w-3.5" />
            Link unreachable
        </span>
    );
}

export function ModerationQueueCard({
    item,
    onApprove,
    onReject,
}: ModerationQueueCardProps) {
    const {
        name,
        company,
        applyLink,
        datePublished,
        moderation,
        linkVerification,
    } = item;

    const formattedDate = datePublished
        ? new Date(datePublished).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "Unknown date";

    return (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] p-4 space-y-3 hover:border-[var(--border-2)] transition-colors">
            {/* Header: name + company */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text)] truncate">
                        {name}
                    </h3>
                    <p className="text-xs text-[var(--text-2)] mt-0.5">
                        {company}
                    </p>
                </div>
                <ScoreBadge score={moderation.score} />
            </div>

            {/* Meta row: apply link + date */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-3)]">
                <a
                    href={applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Apply Link
                </a>
                <span>Published: {formattedDate}</span>
                <LinkStatus reachable={linkVerification?.reachable} />
            </div>

            {/* Moderation flags */}
            {moderation.flags && moderation.flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {moderation.flags.map((flag) => (
                        <span
                            key={flag}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200"
                        >
                            {flag}
                        </span>
                    ))}
                </div>
            )}

            {/* Scam explanation summary */}
            {moderation.scamDetails?.explanationSummary && (
                <div className="text-xs text-[var(--text-2)] bg-[var(--surface-2)] rounded-[var(--radius-sm)] px-3 py-2 border border-[var(--border)]">
                    <span className="font-medium text-[var(--text-3)]">
                        AI Summary:{" "}
                    </span>
                    {moderation.scamDetails.explanationSummary}
                </div>
            )}

            {/* Rejection reason (if already rejected) */}
            {moderation.rejectionReason && (
                <div className="text-xs text-red-600 bg-red-50 rounded-[var(--radius-sm)] px-3 py-2 border border-red-200">
                    <span className="font-medium">Rejection reason: </span>
                    {moderation.rejectionReason}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" size="sm" onClick={onApprove}>
                    Approve
                </Button>
                <Button variant="danger" size="sm" onClick={onReject}>
                    Reject
                </Button>
            </div>
        </div>
    );
}
