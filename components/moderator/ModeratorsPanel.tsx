"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { ModeratorRow } from "./ModeratorRow";
import type { ModeratorSummary } from "@/types/moderator";

interface ModeratorsPanelProps {
    currentModeratorId: string;
}

export function ModeratorsPanel({ currentModeratorId }: ModeratorsPanelProps) {
    const [moderators, setModerators] = useState<ModeratorSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch all moderators on mount
    useEffect(() => {
        const fetchModerators = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/moderator/moderators", {
                    credentials: "include",
                });
                if (!res.ok) {
                    throw new Error("Failed to fetch moderators");
                }
                const json = await res.json();
                setModerators(json.data ?? []);
            } catch {
                toast.error("Failed to load moderators");
            } finally {
                setIsLoading(false);
            }
        };

        fetchModerators();
    }, []);

    const handleVerify = async (moderatorId: string) => {
        // Optimistic update — mark as verified immediately
        const previous = moderators;
        setModerators((prev) =>
            prev.map((m) =>
                m._id === moderatorId
                    ? {
                          ...m,
                          isVerified: true,
                          verifiedAt: new Date().toISOString(),
                      }
                    : m,
            ),
        );

        try {
            const res = await fetch(
                `/api/moderator/moderators/${moderatorId}/verify`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                },
            );

            if (res.ok) {
                toast.success("Moderator verified");
                return;
            }

            // Revert optimistic update on any error
            setModerators(previous);

            const body = await res.json().catch(() => ({}));
            if (res.status === 400) {
                toast.error("Moderators cannot verify themselves");
            } else if (res.status === 409) {
                toast.error("Moderator is already verified");
            } else {
                toast.error(body?.error ?? "Failed to verify moderator");
            }
        } catch {
            setModerators(previous);
            toast.error("Failed to verify moderator");
        }
    };

    return (
        <div className="space-y-4">
            {/* Results count */}
            {!isLoading && (
                <p className="text-xs text-[var(--text-3)]">
                    {moderators.length}{" "}
                    {moderators.length === 1 ? "moderator" : "moderators"} total
                    {" · "}
                    {moderators.filter((m) => !m.isVerified).length} pending
                    verification
                </p>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && moderators.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                    <Users className="h-8 w-8 text-[var(--text-3)]" />
                    <p className="text-sm text-[var(--text-2)]">
                        No moderators found
                    </p>
                </div>
            )}

            {/* Moderators table */}
            {!isLoading && moderators.length > 0 && (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <tr>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    Moderator
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    Status
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide whitespace-nowrap">
                                    Verified By
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide whitespace-nowrap">
                                    Joined
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--surface)]">
                            {moderators.map((moderator) => (
                                <ModeratorRow
                                    key={moderator._id}
                                    moderator={moderator}
                                    currentModeratorId={currentModeratorId}
                                    onVerify={() => handleVerify(moderator._id)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
