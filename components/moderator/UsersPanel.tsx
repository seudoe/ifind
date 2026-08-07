"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UserRow } from "./UserRow";
import type { UserSummary } from "@/types/moderator";

const LIMIT = 20;

export function UsersPanel() {
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    // Debounce search input — 400ms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch users on page/search changes
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(LIMIT),
                });
                if (debouncedSearch.trim()) {
                    params.set("search", debouncedSearch.trim());
                }
                const res = await fetch(
                    `/api/moderator/users?${params.toString()}`,
                    { credentials: "include" },
                );
                if (!res.ok) {
                    throw new Error("Failed to fetch users");
                }
                const json = await res.json();
                setUsers(json.data ?? []);
                setTotal(json.total ?? 0);
            } catch {
                toast.error("Failed to load users");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [page, debouncedSearch]);

    const handleBan = async (userId: string, reason: string) => {
        // Optimistic update
        setUsers((prev) =>
            prev.map((u) =>
                u._id === userId
                    ? { ...u, isBanned: true, bannedReason: reason }
                    : u,
            ),
        );

        try {
            const res = await fetch(`/api/moderator/users/${userId}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ban", reason }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Ban failed");
            }

            toast.success("User has been banned");
        } catch (err) {
            // Revert optimistic update
            setUsers((prev) =>
                prev.map((u) =>
                    u._id === userId
                        ? { ...u, isBanned: false, bannedReason: null }
                        : u,
                ),
            );
            toast.error(
                err instanceof Error ? err.message : "Failed to ban user",
            );
        }
    };

    const handleUnban = async (userId: string) => {
        // Optimistic update
        setUsers((prev) =>
            prev.map((u) =>
                u._id === userId
                    ? {
                          ...u,
                          isBanned: false,
                          bannedReason: null,
                          bannedBy: null,
                          bannedAt: null,
                      }
                    : u,
            ),
        );

        try {
            const res = await fetch(`/api/moderator/users/${userId}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "unban" }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error ?? "Unban failed");
            }

            toast.success("User has been unbanned");
        } catch (err) {
            // Revert optimistic update
            setUsers((prev) =>
                prev.map((u) =>
                    u._id === userId ? { ...u, isBanned: true } : u,
                ),
            );
            toast.error(
                err instanceof Error ? err.message : "Failed to unban user",
            );
        }
    };

    return (
        <div className="space-y-4">
            {/* Search input */}
            <div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, or username..."
                    className="w-full sm:max-w-sm px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors"
                />
            </div>

            {/* Results count */}
            {!isLoading && (
                <p className="text-xs text-[var(--text-3)]">
                    {total} {total === 1 ? "user" : "users"} found
                </p>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && users.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                    <SearchX className="h-8 w-8 text-[var(--text-3)]" />
                    <p className="text-sm text-[var(--text-2)]">
                        No users found
                    </p>
                    {debouncedSearch && (
                        <p className="text-xs text-[var(--text-3)]">
                            Try adjusting your search
                        </p>
                    )}
                </div>
            )}

            {/* Users table */}
            {!isLoading && users.length > 0 && (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <tr>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    User
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    Username
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide whitespace-nowrap">
                                    Joined
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide text-center whitespace-nowrap">
                                    Apps
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    Status
                                </th>
                                <th className="py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--surface)]">
                            {users.map((user) => (
                                <UserRow
                                    key={user._id}
                                    user={user}
                                    onBan={(reason) =>
                                        handleBan(user._id, reason)
                                    }
                                    onUnban={() => handleUnban(user._id)}
                                />
                            ))}
                        </tbody>
                    </table>
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
        </div>
    );
}
