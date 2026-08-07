"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types/moderator";

interface UserRowProps {
    user: UserSummary;
    onBan: (reason: string) => Promise<void>;
    onUnban: () => Promise<void>;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function UserRow({ user, onBan, onUnban }: UserRowProps) {
    const [banExpanded, setBanExpanded] = useState(false);
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleBanConfirm = async () => {
        if (!reason.trim()) return;
        setIsSubmitting(true);
        try {
            await onBan(reason.trim());
            setBanExpanded(false);
            setReason("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnban = async () => {
        setIsSubmitting(true);
        try {
            await onUnban();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <tr className="border-b border-[var(--border)] last:border-0">
            {/* Avatar + Name + Email */}
            <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                    <Avatar
                        src={user.profilePicture}
                        name={user.name}
                        size="sm"
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text)] truncate">
                            {user.name}
                        </p>
                        <p className="text-xs text-[var(--text-3)] truncate">
                            {user.email}
                        </p>
                    </div>
                </div>
            </td>

            {/* Username */}
            <td className="py-3 px-4">
                <span className="text-sm text-[var(--text-2)]">
                    @{user.username}
                </span>
            </td>

            {/* Join date */}
            <td className="py-3 px-4 whitespace-nowrap">
                <span className="text-sm text-[var(--text-2)]">
                    {formatDate(user.createdAt)}
                </span>
            </td>

            {/* Application count */}
            <td className="py-3 px-4 text-center">
                <span className="text-sm text-[var(--text-2)]">
                    {user.applicationCount}
                </span>
            </td>

            {/* Ban status badge */}
            <td className="py-3 px-4">
                {user.isBanned ? (
                    <Badge variant="danger">Banned</Badge>
                ) : (
                    <Badge variant="success">Active</Badge>
                )}
            </td>

            {/* Actions */}
            <td className="py-3 px-4">
                {user.isBanned ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        loading={isSubmitting}
                        onClick={handleUnban}
                    >
                        Unban
                    </Button>
                ) : banExpanded ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason..."
                            className={cn(
                                "px-2 py-1 text-xs rounded-[var(--radius-sm)]",
                                "border border-[var(--border)] bg-[var(--surface-2)]",
                                "text-[var(--text)] placeholder:text-[var(--text-3)]",
                                "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent",
                                "w-36",
                            )}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    setBanExpanded(false);
                                    setReason("");
                                }
                            }}
                        />
                        <Button
                            variant="danger"
                            size="sm"
                            loading={isSubmitting}
                            disabled={!reason.trim()}
                            onClick={handleBanConfirm}
                        >
                            Confirm
                        </Button>
                        <button
                            onClick={() => {
                                setBanExpanded(false);
                                setReason("");
                            }}
                            className="text-xs text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setBanExpanded(true)}
                    >
                        Ban
                    </Button>
                )}
            </td>
        </tr>
    );
}
