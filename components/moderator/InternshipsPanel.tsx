"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CheckCheck, Loader2, SearchX, ArrowUpDown, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ModerationQueueCard } from "./ModerationQueueCard";
import { ModerationRejectModal } from "./ModerationRejectModal";
import type { ModerationQueueItem } from "@/types/moderator";

type StatusFilter = "pending_review" | "auto_rejected" | "manually_rejected";
type SortByOption = "scamScore" | "deadline" | "scrapedTime" | "name" | "company";

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
    const [nameFilter, setNameFilter] = useState("");
    const [debouncedName, setDebouncedName] = useState("");
    const [companyFilter, setCompanyFilter] = useState("");
    const [debouncedCompany, setDebouncedCompany] = useState("");
    const [scoreOp, setScoreOp] = useState<"" | "lt" | "gt" | "eq">("");
    const [scoreVal, setScoreVal] = useState<string>("");
    const [debouncedScoreVal, setDebouncedScoreVal] = useState<string>("");
    const [sortBy, setSortBy] = useState<SortByOption>("scamScore");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const [rejectTarget, setRejectTarget] =
        useState<ModerationQueueItem | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBatchApproving, setIsBatchApproving] = useState(false);
    const [isBatchRejecting, setIsBatchRejecting] = useState(false);
    const [isBatchRejectModalOpen, setIsBatchRejectModalOpen] = useState(false);
    const [batchRejectMode, setBatchRejectMode] = useState<"selected" | "filtered">("selected");

    const limit = 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Debounce inputs: 400ms delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setDebouncedName(nameFilter);
            setDebouncedCompany(companyFilter);
            setDebouncedScoreVal(scoreVal);
            setPage(1); // reset to page 1 on new search
            setSelectedIds(new Set());
        }, 400);
        return () => clearTimeout(timer);
    }, [search, nameFilter, companyFilter, scoreVal]);

    const fetchQueue = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                status: statusFilter,
                ...(source === "employer" ? { source } : {}),
                page: String(page),
                limit: String(limit),
                sortBy,
                sortOrder,
            });
            if (debouncedSearch.trim()) {
                params.set("search", debouncedSearch.trim());
            }
            if (debouncedName.trim()) {
                params.set("name", debouncedName.trim());
            }
            if (debouncedCompany.trim()) {
                params.set("company", debouncedCompany.trim());
            }
            if (scoreOp && debouncedScoreVal.trim() !== "") {
                params.set("scoreOp", scoreOp);
                params.set("scoreVal", debouncedScoreVal.trim());
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
    }, [page, statusFilter, debouncedSearch, debouncedName, debouncedCompany, scoreOp, debouncedScoreVal, sortBy, sortOrder, source]);

    // Fetch queue whenever dependencies change
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

            // Remove approved items from view
            setItems((prev) => prev.filter((i) => !approvedSet.has(i._id)));
            setTotal((prev) => Math.max(0, prev - approvedSet.size));
            setSelectedIds(new Set());

            const message = body?.message || "the batch has been approved and saved to collection(database)";
            toast.success(message);
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to approve selected internships",
            );
            fetchQueue();
        } finally {
            setIsBatchApproving(false);
        }
    };

    const handleApproveAllFiltered = async () => {
        if (items.length === 0 || isBatchApproving) return;
        const idsToApprove = items.map((i) => i._id);
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
                throw new Error(err?.error ?? "Approve filtered batch failed");
            }

            const body = await res.json().catch(() => ({}));
            const message = body?.message || `Successfully approved ${idsToApprove.length} internships`;
            toast.success(message);
            fetchQueue();
            setSelectedIds(new Set());
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to approve filtered internships",
            );
        } finally {
            setIsBatchApproving(false);
        }
    };

    const handleBatchRejectConfirm = async (reason: string) => {
        const idsToReject = batchRejectMode === "selected"
            ? Array.from(selectedIds)
            : items.map((i) => i._id);

        if (idsToReject.length === 0 || isBatchRejecting) return;
        setIsBatchRejecting(true);
        setIsBatchRejectModalOpen(false);

        try {
            const res = await fetch("/api/moderator/internships/batch-reject", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ids: idsToReject,
                    source,
                    rejectionReason: reason,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Batch reject failed");
            }

            toast.success(`Successfully rejected ${idsToReject.length} internships`);
            fetchQueue();
            setSelectedIds(new Set());
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Failed to reject internships",
            );
        } finally {
            setIsBatchRejecting(false);
        }
    };

    const handleApprove = async (item: ModerationQueueItem) => {
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
            setItems((prev) => [target, ...prev]);
            setTotal((prev) => prev + 1);
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Failed to reject internship",
            );
        }
    };

    const hasActiveFilters = Boolean(nameFilter || companyFilter || (scoreOp && scoreVal) || search);

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

            {/* Search, Filter & Sort Controls */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {/* Name input */}
                    <div>
                        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1">Internship Name</label>
                        <input
                            type="text"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            placeholder="Filter by name..."
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                    </div>

                    {/* Company input */}
                    <div>
                        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1">Company</label>
                        <input
                            type="text"
                            value={companyFilter}
                            onChange={(e) => setCompanyFilter(e.target.value)}
                            placeholder="Filter by company..."
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                    </div>

                    {/* Scam score filter */}
                    <div>
                        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1">Scam Score</label>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={scoreOp}
                                onChange={(e) => setScoreOp(e.target.value as any)}
                                className="px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            >
                                <option value="">Any</option>
                                <option value="lt">&lt; Less than</option>
                                <option value="gt">&gt; Greater than</option>
                                <option value="eq">= Equals</option>
                            </select>
                            {scoreOp && (
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={scoreVal}
                                    onChange={(e) => setScoreVal(e.target.value)}
                                    placeholder="0-100"
                                    className="w-20 px-2 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                                />
                            )}
                        </div>
                    </div>

                    {/* Sort Selector */}
                    <div>
                        <label className="block text-[11px] font-medium text-[var(--text-3)] mb-1">Sort By</label>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="flex-1 px-2.5 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            >
                                <option value="scamScore">Scam Score</option>
                                <option value="deadline">Deadline</option>
                                <option value="scrapedTime">Scraped Time</option>
                                <option value="name">Internship Name</option>
                                <option value="company">Company Name</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                                title={sortOrder === "asc" ? "Ascending order" : "Descending order"}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] transition-colors shrink-0"
                            >
                                <ArrowUpDown className="h-3 w-3" />
                                <span>{sortOrder === "asc" ? "Asc" : "Desc"}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                        <span className="text-[11px] text-[var(--text-3)]">Active filters applied</span>
                        <button
                            type="button"
                            onClick={() => {
                                setNameFilter("");
                                setCompanyFilter("");
                                setScoreOp("");
                                setScoreVal("");
                                setSearch("");
                            }}
                            className="text-xs text-[var(--primary)] hover:underline"
                        >
                            Reset all filters
                        </button>
                    </div>
                )}
            </div>

            {/* Batch actions & Filter action toolbar */}
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

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Approve all filtered button */}
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={items.length === 0 || isBatchApproving || isBatchRejecting}
                            onClick={handleApproveAllFiltered}
                            className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            <span>Approve all filtered ({total})</span>
                        </Button>

                        {/* Reject all filtered button */}
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={items.length === 0 || isBatchApproving || isBatchRejecting}
                            onClick={() => {
                                setBatchRejectMode("filtered");
                                setIsBatchRejectModalOpen(true);
                            }}
                            className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-500/30"
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject all filtered ({total})</span>
                        </Button>

                        {selectedIds.size > 0 && (
                            <>
                                <div className="h-4 w-px bg-[var(--border)] mx-1" />
                                <span className="text-xs text-[var(--text-3)] font-medium">
                                    {selectedIds.size} selected
                                </span>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={isBatchApproving || isBatchRejecting}
                                    onClick={handleBatchApprove}
                                    className="gap-1.5 text-xs"
                                >
                                    {isBatchApproving ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            <span>Approving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCheck className="h-3.5 w-3.5" />
                                            <span>Approve selected ({selectedIds.size})</span>
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={isBatchApproving || isBatchRejecting}
                                    onClick={() => {
                                        setBatchRejectMode("selected");
                                        setIsBatchRejectModalOpen(true);
                                    }}
                                    className="gap-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-500/20"
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span>Reject selected ({selectedIds.size})</span>
                                </Button>
                            </>
                        )}
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
                    {hasActiveFilters && (
                        <p className="text-xs text-[var(--text-3)]">
                            Try adjusting your filters or search query
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

            {/* Single reject modal */}
            <ModerationRejectModal
                open={rejectTarget !== null}
                internshipName={rejectTarget?.name ?? ""}
                onConfirm={handleRejectConfirm}
                onClose={() => setRejectTarget(null)}
            />

            {/* Batch reject modal */}
            <ModerationRejectModal
                open={isBatchRejectModalOpen}
                internshipName={batchRejectMode === "selected" ? `${selectedIds.size} selected internships` : `${total} filtered internships`}
                onConfirm={handleBatchRejectConfirm}
                onClose={() => setIsBatchRejectModalOpen(false)}
            />
        </div>
    );
}
