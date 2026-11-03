"use client";

import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import type { StudentRow } from "@/lib/campus/studentRow";

interface Data { items: StudentRow[]; total: number; page: number; pageSize: number; uidLabel: string }

/** Joined students of the campus (staff only). Removing and barring students arrive with applications. */
export function CampusStudentsTable({ entityId }: { entityId: string }) {
    const [q, setQ] = useState("");
    const [term, setTerm] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Search runs 300 ms after typing stops
    useEffect(() => {
        const t = setTimeout(() => { setTerm(q); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        let live = true;
        fetch(`/api/employer/campus/${entityId}/students?q=${encodeURIComponent(term)}&page=${page}`, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => { if (!live) return; if (j.success) { setData(j.data); setError(null); } else setError(j.error); })
            .catch(() => live && setError("Unable to load students"));
        return () => { live = false; };
    }, [entityId, term, page]);

    const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <div className="max-w-5xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-bold text-[var(--heading)]">Students {data && <span className="text-sm font-normal text-[var(--text-3)]">{data.total}</span>}</h1>
                <div className="w-full sm:w-72"><Input aria-label="Search students" placeholder="Search name, ID, course, batch" value={q} onChange={(e) => setQ(e.target.value)} leftIcon={<Search className="h-4 w-4" />} /></div>
            </div>

            {error ? (
                <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : !data ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : data.items.length === 0 ? (
                <div className="plasma-card p-10 text-center">
                    <Users className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" />
                    <p className="text-sm text-[var(--text-2)]">{term ? "No student matches that search." : "No student has joined yet. Share your join code from Overview."}</p>
                </div>
            ) : (
                <div className="plasma-card overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="text-left text-xs font-mono uppercase tracking-[0.07em] text-[var(--text-3)]">
                            <tr>
                                <th className="px-4 py-3 font-medium">Student</th>
                                <th className="px-4 py-3 font-medium">{data.uidLabel}</th>
                                <th className="px-4 py-3 font-medium">Course</th>
                                <th className="px-4 py-3 font-medium">Batch</th>
                                <th className="px-4 py-3 font-medium text-right">CGPA</th>
                                <th className="px-4 py-3 font-medium">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((s) => (
                                <tr key={s.userId} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-[var(--text)]">{s.name}</p>
                                        <p className="text-xs text-[var(--text-3)]">{s.email}{s.phone ? ` · ${s.phone}` : ""}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-[var(--text)]">{s.collegeUid}</span>
                                        {s.duplicateUid && <Badge variant="warning" className="ml-2" >Duplicate ID</Badge>}
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text-2)]">{s.course}<span className="block text-xs text-[var(--text-3)]">{s.department}</span></td>
                                    <td className="px-4 py-3 tabular-nums">{s.batch}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{s.cgpa ?? "-"}</td>
                                    <td className="px-4 py-3 text-[var(--text-2)]">{s.joinedAt ? new Date(s.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data && pages > 1 && (
                <div className="flex items-center justify-between text-sm text-[var(--text-2)]">
                    <span>Page {data.page} of {pages}</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
