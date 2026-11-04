"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CheckCheck, Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ModerationQueueCard } from "./ModerationQueueCard";
import { ModerationRejectModal } from "./ModerationRejectModal";
import type { ModerationQueueItem } from "@/types/moderator";

type StatusFilter = "pending_review" | "auto_rejected" | "manually_rejected";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "pending_review", label: "Pending Review" },
    { value: "auto_rejected", label: "Auto Rejected" },
    { value: "manually_rejected", label: "Manually Rejected" },
];

export function InternshipsPanel() {
    const [items, setItems] = useState<ModerationQueueItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [source, setSource] = useState<"scraped" | "employer">("scraped");
    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>("pending_review");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [rejectTarget, setRejectTarget] =
        useState<ModerationQueueItem | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBatchApproving, setIsBatchApproving] = useState(false);

    const limit = 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Debounce search input: 400ms delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // reset to page 1 on new search
            setSelectedIds(new Set());
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchQueue = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                status: statusFilter,
                ...(source === "employer" ? { source } : {}),
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
    }, [page, statusFilter, debouncedSearch, source]);

    // Fetch queue whenever page, statusFilter, debouncedSearch, or source changes
    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const handleSourceChange = (next: "scraped" | "employer") => {
        setSource(next);
        setPage(1);
        setSelectedIds(new Set());
    };

    const handleStatusFilterChange = (status: StatusFilter) => {
        setStatusFilter(status);
        setPage(1);
        setSelectedIds(new Set());
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const allPageSelected =
        items.length > 0 && items.every((i) => selectedIds.has(i._id));

    const handleToggleSelectAll = () => {
        if (allPageSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map((i) => i._id)));
        }
    };

    const handleBatchApprove = async () => {
        if (selectedIds.size === 0 || isBatchApproving) return;
        const idsToApprove = Array.from(selectedIds);
        setIsBatchApproving(true);

        try {
            const res = await fetch("/api/moderator/internships/batch-approve", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: idsToApprove,
                    source,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Batch approve failed");
            }

            const body = await res.json().catch(() => ({}));
            const approvedIds: string[] = body?.indexedIds ?? idsToApprove;
            const approvedSet = new Set(approvedIds);

            // Optimistically remove approved items from view
            setItems((prev) => prev.filter((i) => !approvedSet.has(i._id)));
            setTotal((prev) => Math.max(0, prev - approvedSet.size));
            setSelectedIds(new Set());

            toast.success("the batch has been approved and saved to collection(database)");
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to approve selected internships",
            );
            // Re-fetch in case partial processing finished on backend
            fetchQueue();
        } finally {
            setIsBatchApproving(false);
        }
    };

    const handleApprove = async (item: ModerationQueueItem) => {
        // Optimistic removal
        setItems((prev) => prev.filter((i) => i._id !== item._id));
        setTotal((prev) => Math.max(0, prev - 1));
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(item._id);
            return next;
        });

        try {
            const res = await fetch(`/api/moderator/internships/${item._id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve", ...(source === "employer" ? { source } : {}) }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Approve failed");
            }

            const body = await res.json().catch(() => ({}));
            if (body?.published === false) {
                toast.warning(`"${item.name}" approved — indexing is pending and will retry`);
            } else {
                toast.success(`"${item.name}" has been approved`);
            }
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
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(target._id);
            return next;
        });

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
                        ...(source === "employer" ? { source } : {}),
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
            {/* Source switch */}
            <div className="inline-flex rounded-[var(--radius-sm)] border border-[var(--border)] p-0.5 text-sm">
                {([["scraped", "Scraped"], ["employer", "Employer-posted"]] as const).map(([value, label]) => (
                    <button
                        key={value}
                        onClick={() => handleSourceChange(value)}
                        className={cn(
                            "px-3 py-1 rounded-[calc(var(--radius-sm)-2px)] font-medium transition-colors",
                            source === value ? "bg-[var(--primary)] text-white" : "text-[var(--text-2)] hover:text-[var(--text)]",
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>

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

            {/* Batch actions toolbar */}
            {!isLoading && items.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-2)] cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={allPageSelected}
                            onChange={handleToggleSelectAll}
                            className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer accent-[var(--primary)]"
                        />
                        <span>
                            Select all on this page ({items.length})
                        </span>
                    </label>

                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <span className="text-xs text-[var(--text-3)] font-medium">
                                {selectedIds.size} selected
                            </span>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={selectedIds.size === 0 || isBatchApproving}
                            onClick={handleBatchApprove}
                            className="gap-1.5"
                        >
                            {isBatchApproving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Approving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    <span>
                                        Approve selected
                                        {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                                    </span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

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
                            selected={selectedIds.has(item._id)}
                            onToggleSelect={() => handleToggleSelect(item._id)}
                            onApprove={() => handleApprove(item)}
                            onReject={() => handleRejectClick(item)}
                            isApproving={isBatchApproving}
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
                        onClick={() => {
                            setPage((p) => Math.max(1, p - 1));
                            setSelectedIds(new Set());
                        }}
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
                        onClick={() => {
                            setPage((p) => Math.min(totalPages, p + 1));
                            setSelectedIds(new Set());
                        }}
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
