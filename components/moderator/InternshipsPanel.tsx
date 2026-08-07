"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ModerationQueueCard } from "./ModerationQueueCard";
import { ModerationRejectModal } from "./ModerationRejectModal";
import type { ModerationQueueItem } from "@/types/moderator";

type StatusFilter = "pending_review" | "auto_rejected";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "pending_review", label: "Pending Review" },
    { value: "auto_rejected", label: "Auto Rejected" },
];

export function InternshipsPanel() {
    const [items, setItems] = useState<ModerationQueueItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>("pending_review");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [rejectTarget, setRejectTarget] =
        useState<ModerationQueueItem | null>(null);

    const limit = 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Debounce search input: 400ms delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // reset to page 1 on new search
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch queue whenever page, statusFilter, or debouncedSearch changes
    useEffect(() => {
        const fetchQueue = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    status: statusFilter,
                    page: String(page),
                    limit: String(limit),
                });
                if (debouncedSearch.trim()) {
                    params.set("search", debouncedSearch.trim());
                }
                const res = await fetch(
                    `/api/moderator/internships?${params.toString()}`,
                    {
                        credentials: "include",
                    },
                );
                if (!res.ok) {
                    throw new Error("Failed to fetch internships");
                }
                const json = await res.json();
                setItems(json.data ?? []);
                setTotal(json.total ?? 0);
            } catch {
                toast.error("Failed to load internship queue");
            } finally {
                setIsLoading(false);
            }
        };

        fetchQueue();
    }, [page, statusFilter, debouncedSearch]);

    const handleStatusFilterChange = (status: StatusFilter) => {
        setStatusFilter(status);
        setPage(1);
    };

    const handleApprove = async (item: ModerationQueueItem) => {
        // Optimistic removal
        setItems((prev) => prev.filter((i) => i._id !== item._id));
        setTotal((prev) => Math.max(0, prev - 1));

        try {
            const res = await fetch(`/api/moderator/internships/${item._id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Approve failed");
            }

            toast.success(`"${item.name}" has been approved`);
        } catch (err) {
            // Revert optimistic update on failure
            setItems((prev) => [item, ...prev]);
            setTotal((prev) => prev + 1);
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to approve internship",
            );
        }
    };

    const handleRejectClick = (item: ModerationQueueItem) => {
        setRejectTarget(item);
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectTarget) return;
        const target = rejectTarget;
        setRejectTarget(null);

        // Optimistic removal
        setItems((prev) => prev.filter((i) => i._id !== target._id));
        setTotal((prev) => Math.max(0, prev - 1));

        try {
            const res = await fetch(
                `/api/moderator/internships/${target._id}`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "reject",
                        rejectionReason: reason,
                    }),
                },
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Reject failed");
            }

            toast.success(`"${target.name}" has been rejected`);
        } catch (err) {
            // Revert optimistic update on failure
            setItems((prev) => [target, ...prev]);
            setTotal((prev) => prev + 1);
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to reject internship",
            );
        }
    };

    return (
        <div className="space-y-4">
            {/* Status filter tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] pb-0">
                {STATUS_TABS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => handleStatusFilterChange(value)}
                        className={cn(
                            "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                            statusFilter === value
                                ? "border-[var(--primary)] text-[var(--primary)]"
                                : "border-transparent text-[var(--text-2)] hover:text-[var(--text)]",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Search input */}
            <div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or company..."
                    className="w-full sm:max-w-sm px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                />
            </div>

            {/* Results count */}
            {!isLoading && (
                <p className="text-xs text-[var(--text-3)]">
                    {total} {total === 1 ? "listing" : "listings"} found
                </p>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                    <SearchX className="h-8 w-8 text-[var(--text-3)]" />
                    <p className="text-sm text-[var(--text-2)]">
                        No internships found
                    </p>
                    {debouncedSearch && (
                        <p className="text-xs text-[var(--text-3)]">
                            Try adjusting your search
                        </p>
                    )}
                </div>
            )}

            {/* Queue cards */}
            {!isLoading && items.length > 0 && (
                <div className="space-y-3">
                    {items.map((item) => (
                        <ModerationQueueCard
                            key={item._id}
                            item={item}
                            onApprove={() => handleApprove(item)}
                            onReject={() => handleRejectClick(item)}
                        />
                    ))}
                </div>
            )}

            {/* Pagination controls */}
            {!isLoading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Prev
                    </Button>
                    <span className="text-xs text-[var(--text-2)]">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                        }
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Reject modal */}
            <ModerationRejectModal
                open={rejectTarget !== null}
                internshipName={rejectTarget?.name ?? ""}
                onConfirm={handleRejectConfirm}
                onClose={() => setRejectTarget(null)}
            />
        </div>
    );
}
