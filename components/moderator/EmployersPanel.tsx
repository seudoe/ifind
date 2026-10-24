"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, SearchX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { EmployerSummary } from "@/types/moderator";

const LIMIT = 20;
const TH = "py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] font-mono uppercase tracking-[0.07em] whitespace-nowrap";
const INPUT =
    "px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors";

const when = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "never";

interface Detail {
    employer: Record<string, unknown> & EmployerSummary & { linkedinId?: string | null; linkedinDetails?: unknown; deleteDetails?: { deleted: boolean } };
    companies: Array<{ _id: string; name: string; slug: string; industry: string; size: string; city?: string; verification?: string; isActive: boolean; role?: string }>;
    internships: Array<{ _id: string; name: string; status: string; createdAt: string }>;
    banHistory: Array<{ _id: string; action: "ban" | "unban"; reason: string | null; moderatorName?: string | null; at: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-5">
            <h4 className="text-xs font-semibold font-mono uppercase tracking-[0.07em] text-[var(--text-3)] mb-2">{title}</h4>
            {children}
        </section>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-[var(--text-3)]">{label}</dt>
            <dd className="text-sm text-[var(--text)] break-words">{value || "—"}</dd>
        </div>
    );
}

function BanControls({ banned, onBan, onUnban }: { banned: boolean; onBan: (reason: string) => Promise<void>; onUnban: () => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        try {
            await fn();
            setOpen(false);
            setReason("");
        } finally {
            setBusy(false);
        }
    };

    if (banned) {
        return <Button variant="secondary" size="sm" loading={busy} onClick={() => run(onUnban)}>Unban</Button>;
    }
    if (!open) {
        return <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Ban</Button>;
    }
    return (
        <div className="flex items-center gap-2">
            <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setReason(""))}
                placeholder="Reason..."
                className={`${INPUT} !py-1 !text-xs w-40`}
            />
            <Button variant="danger" size="sm" loading={busy} disabled={!reason.trim()} onClick={() => run(() => onBan(reason.trim()))}>
                Confirm
            </Button>
            <button onClick={() => { setOpen(false); setReason(""); }} className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">
                Cancel
            </button>
        </div>
    );
}

export function EmployersPanel() {
    const [rows, setRows] = useState<EmployerSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [selected, setSelected] = useState<EmployerSummary | null>(null);
    const [detail, setDetail] = useState<{ id: string; data: Detail } | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    useEffect(() => {
        const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
                if (debounced.trim()) p.set("search", debounced.trim());
                const res = await fetch(`/api/moderator/employers?${p}`, { credentials: "include" });
                if (!res.ok) throw new Error();
                const json = await res.json();
                setRows(json.data ?? []);
                setTotal(json.total ?? 0);
            } catch {
                toast.error("Failed to load employers");
            } finally {
                setLoading(false);
            }
        })();
    }, [page, debounced, reloadKey]);

    const loadDetail = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/moderator/employers/${id}`, { credentials: "include" });
            if (!res.ok) throw new Error();
            setDetail({ id, data: (await res.json()).data });
        } catch {
            toast.error("Failed to load employer details");
        }
    }, []);

    useEffect(() => {
        if (selected) loadDetail(selected._id);
    }, [selected, loadDetail]);

    const act = async (id: string, body: { action: "ban" | "unban"; reason?: string }) => {
        const res = await fetch(`/api/moderator/employers/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast.error(err?.error ?? `Failed to ${body.action}`);
            return;
        }
        toast.success(body.action === "ban" ? "Employer banned" : "Employer unbanned");
        setReloadKey((k) => k + 1);
        if (selected?._id === id) loadDetail(id);
    };

    const d = detail && selected && detail.id === selected._id ? detail.data : null;

    return (
        <div className="space-y-4">
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone or designation..."
                className={`${INPUT} w-full sm:max-w-sm`}
            />

            {!loading && <p className="text-xs text-[var(--text-3)]">{total} employer{total === 1 ? "" : "s"}</p>}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /></div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-3)]">
                    <SearchX className="h-6 w-6" />
                    <p className="text-sm">No employers found</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <tr>
                                <th className={TH}>Employer</th>
                                <th className={TH}>Designation</th>
                                <th className={TH}>Joined</th>
                                <th className={`${TH} text-center`}>Companies</th>
                                <th className={TH}>Status</th>
                                <th className={TH}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--surface)]">
                            {rows.map((e) => (
                                <tr key={e._id} className="border-b border-[var(--border)] last:border-0">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar src={e.profilePicture} name={e.name} size="sm" />
                                            <div className="min-w-0">
                                                <button type="button" onClick={() => setSelected(e)} className="block max-w-full text-left text-sm font-medium text-[var(--text)] truncate hover:text-[var(--primary)] hover:underline">{e.name}</button>
                                                <p className="text-xs text-[var(--text-3)] truncate">{e.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)]">{e.designation || "—"}</td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)] whitespace-nowrap">
                                        {new Date(e.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)] text-center">{e.companyCount}</td>
                                    <td className="py-3 px-4">
                                        {e.isBanned ? <Badge variant="danger">Banned</Badge> : <Badge variant="success">Active</Badge>}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => setSelected(e)}>Details</Button>
                                            <BanControls
                                                banned={e.isBanned}
                                                onBan={(reason) => act(e._id, { action: "ban", reason })}
                                                onUnban={() => act(e._id, { action: "unban" })}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <span className="text-xs text-[var(--text-2)]">Page {page} of {totalPages}</span>
                    <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
            )}

            <Modal
                open={!!selected}
                onClose={() => { setSelected(null); setDetail(null); }}
                size="xl"
                title={selected?.name}
                description={selected?.email}
            >
                {!d ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /></div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div className="flex items-center gap-2">
                                {d.employer.isBanned ? <Badge variant="danger">Banned</Badge> : <Badge variant="success">Active</Badge>}
                                {d.employer.isEmailVerified ? <Badge variant="success">Email verified</Badge> : <Badge variant="warning">Email unverified</Badge>}
                                {d.employer.deleteDetails?.deleted && <Badge variant="danger">Deleted</Badge>}
                            </div>
                            <BanControls
                                banned={d.employer.isBanned}
                                onBan={(reason) => act(d.employer._id, { action: "ban", reason })}
                                onUnban={() => act(d.employer._id, { action: "unban" })}
                            />
                        </div>

                        {d.employer.isBanned && d.employer.bannedReason && (
                            <p className="mb-5 text-sm text-[var(--danger)]">Ban reason: {d.employer.bannedReason}</p>
                        )}

                        <Section title="Profile">
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <Field label="Name" value={d.employer.name} />
                                <Field label="Email" value={d.employer.email} />
                                <Field label="Phone" value={d.employer.phone} />
                                <Field label="Designation" value={d.employer.designation} />
                                <Field label="Joined" value={when(d.employer.createdAt)} />
                                <Field label="Last login" value={when(d.employer.lastLoginAt)} />
                                <Field label="Sign-in" value={d.employer.linkedinId ? "LinkedIn" : "Password"} />
                                <Field label="ID" value={<code className="text-xs">{d.employer._id}</code>} />
                            </dl>
                        </Section>

                        <Section title={`Companies (${d.companies.length})`}>
                            {d.companies.length === 0 ? (
                                <p className="text-sm text-[var(--text-3)]">Not a member of any company.</p>
                            ) : (
                                <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-sm)]">
                                    {d.companies.map((c) => (
                                        <li key={c._id} className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
                                            <span className="font-medium text-[var(--text)]">{c.name}</span>
                                            <span className="text-xs text-[var(--text-3)]">{[c.industry, c.size, c.city].filter(Boolean).join(" · ")}</span>
                                            <span className="ml-auto flex items-center gap-1.5">
                                                {c.role && <Badge variant="default">{c.role}</Badge>}
                                                {c.verification && <Badge variant={c.verification === "verified" ? "success" : "warning"}>{c.verification}</Badge>}
                                                {!c.isActive && <Badge variant="danger">inactive</Badge>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>

                        <Section title={`Internships posted (${d.internships.length})`}>
                            {d.internships.length === 0 ? (
                                <p className="text-sm text-[var(--text-3)]">None.</p>
                            ) : (
                                <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-sm)] max-h-56 overflow-y-auto">
                                    {d.internships.map((i) => (
                                        <li key={i._id} className="px-3 py-2 flex items-center gap-2 text-sm">
                                            <span className="text-[var(--text)] truncate">{i.name}</span>
                                            <Badge variant="default" className="ml-auto">{i.status}</Badge>
                                            <span className="text-xs text-[var(--text-3)] whitespace-nowrap">{when(i.createdAt)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>

                        <Section title="Ban history">
                            {d.banHistory.length === 0 ? (
                                <p className="text-sm text-[var(--text-3)]">No bans or unbans on record.</p>
                            ) : (
                                <ul className="space-y-1.5 text-sm">
                                    {d.banHistory.map((h) => (
                                        <li key={h._id}>
                                            <Badge variant={h.action === "ban" ? "danger" : "success"}>{h.action}</Badge>{" "}
                                            <span className="text-[var(--text-2)]">
                                                {when(h.at)} by {h.moderatorName ?? "moderator"}{h.reason ? ` — ${h.reason}` : ""}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>
                    </>
                )}
            </Modal>
        </div>
    );
}
