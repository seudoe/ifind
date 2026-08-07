"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ModeratorSummary } from "@/types/moderator";

interface ModeratorRowProps {
    moderator: ModeratorSummary;
    currentModeratorId: string;
    onVerify: () => Promise<void>;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function ModeratorRow({
    moderator,
    currentModeratorId,
    onVerify,
}: ModeratorRowProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleVerify = async () => {
        setIsSubmitting(true);
        try {
            await onVerify();
        } finally {
            setIsSubmitting(false);
        }
    };

    const showVerifyButton =
        !moderator.isVerified && moderator._id !== currentModeratorId;

    return (
        <tr className="border-b border-[var(--border)] last:border-0">
            {/* Name + Email */}
            <td className="py-3 px-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">
                        {moderator.name}
                    </p>
                    <p className="text-xs text-[var(--text-3)] truncate">
                        {moderator.email}
                    </p>
                </div>
            </td>

            {/* Verification status */}
            <td className="py-3 px-4">
                {moderator.isVerified ? (
                    <Badge variant="success">Verified</Badge>
                ) : (
                    <Badge variant="warning">Unverified</Badge>
                )}
            </td>

            {/* Verified by / at */}
            <td className="py-3 px-4">
                {moderator.isVerified && moderator.verifiedBy ? (
                    <div className="min-w-0">
                        <p className="text-xs text-[var(--text-2)]">
                            by{" "}
                            <span className="font-medium text-[var(--text)]">
                                {moderator.verifiedBy}
                            </span>
                        </p>
                        {moderator.verifiedAt && (
                            <p className="text-xs text-[var(--text-3)]">
                                {formatDate(moderator.verifiedAt)}
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-[var(--text-3)]">—</span>
                )}
            </td>

            {/* Joined date */}
            <td className="py-3 px-4 whitespace-nowrap">
                <span className="text-sm text-[var(--text-2)]">
                    {formatDate(moderator.createdAt)}
                </span>
            </td>

            {/* Actions */}
            <td className="py-3 px-4">
                {showVerifyButton && (
                    <Button
                        variant="primary"
                        size="sm"
                        loading={isSubmitting}
                        onClick={handleVerify}
                    >
                        Verify
                    </Button>
                )}
            </td>
        </tr>
    );
}
