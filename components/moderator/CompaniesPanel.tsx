"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, SearchX } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Status = "none" | "restricted" | "banned";
type Action = "restrict" | "ban" | "lift";

interface CompanyRow {
    _id: string;
    name: string;
    slug: string;
    logo?: string | null;
    industry: string;
    size: string;
    headquarters?: { city?: string; state?: string; country?: string };
    contactEmail: string;
    verification?: { status?: string };
    restriction: { status: Status; reason?: string | null; at?: string | null };
    isActive: boolean;
    memberCount: number;
    internshipCount: number;
    createdAt: string;
}

interface Detail {
    company: Record<string, any> & CompanyRow;
    members: Array<{ employerId: string; role: string; name: string; email: string; isBanned: boolean }>;
    internships: Array<{ _id: string; name: string; status: string; isActive?: boolean; bannedByCompany?: boolean; moderation?: { status?: string }; createdAt: string }>;
    applications: number;
    history: Array<{ _id: string; action: "ban" | "unban"; reason: string | null; moderatorName?: string | null; at: string }>;
}

const TH = "py-2.5 px-4 text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide whitespace-nowrap";
const INPUT =
    "px-3 py-2 text-sm rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors";
const LIMIT = 20;

const when = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function StatusBadge({ status }: { status: Status }) {
    if (status === "banned") return <Badge variant="danger">Banned</Badge>;
    if (status === "restricted") return <Badge variant="warning">Restricted</Badge>;
    return <Badge variant="success">Active</Badge>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">{title}</h4>
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

/** Restrict / Ban each ask for a reason; Lift is one click. */
function Controls({ status, onAct }: { status: Status; onAct: (action: Action, reason?: string) => Promise<void> }) {
    const [pending, setPending] = useState<Exclude<Action, "lift"> | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const run = async (action: Action, r?: string) => {
        setBusy(true);
        try {
            await onAct(action, r);
            setPending(null);
            setReason("");
        } finally {
            setBusy(false);
        }
    };

    if (pending) {
        return (
            <div className="flex items-center gap-2">
                <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && (setPending(null), setReason(""))}
                    placeholder={`Reason to ${pending}...`}
                    className={`${INPUT} !py-1 !text-xs w-44`}
                />
                <Button variant="danger" size="sm" loading={busy} disabled={!reason.trim()} onClick={() => run(pending, reason.trim())}>
                    Confirm
                </Button>
                <button onClick={() => { setPending(null); setReason(""); }} className="text-xs text-[var(--text-3)] hover:text-[var(--text)]">
                    Cancel
                </button>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2">
            {status !== "none" && (
                <Button variant="secondary" size="sm" loading={busy} onClick={() => run("lift")}>
                    {status === "banned" ? "Unban" : "Unrestrict"}
                </Button>
            )}
            {status === "none" && (
                <Button variant="secondary" size="sm" onClick={() => setPending("restrict")}>Restrict</Button>
            )}
            {status !== "banned" && (
                <Button variant="danger" size="sm" onClick={() => setPending("ban")}>Ban</Button>
            )}
        </div>
    );
}

export function CompaniesPanel() {
    const [rows, setRows] = useState<CompanyRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [filter, setFilter] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [selected, setSelected] = useState<CompanyRow | null>(null);
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
                if (filter) p.set("status", filter);
                const res = await fetch(`/api/moderator/companies?${p}`, { credentials: "include" });
                if (!res.ok) throw new Error();
                const json = await res.json();
                setRows(json.data ?? []);
                setTotal(json.total ?? 0);
            } catch {
                toast.error("Failed to load companies");
            } finally {
                setLoading(false);
            }
        })();
    }, [page, debounced, filter, reloadKey]);

    const loadDetail = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/moderator/companies/${id}`, { credentials: "include" });
            if (!res.ok) throw new Error();
            setDetail({ id, data: (await res.json()).data });
        } catch {
            toast.error("Failed to load company details");
        }
    }, []);

    useEffect(() => {
        if (selected) loadDetail(selected._id);
    }, [selected, loadDetail]);

    const act = async (id: string, action: Action, reason?: string) => {
        const res = await fetch(`/api/moderator/companies/${id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, reason }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            toast.error(json?.error ?? "Action failed");
            return;
        }
        const n = json.data?.internshipsAffected ?? 0;
        toast.success(
            action === "ban" ? `Company banned, ${n} internship${n === 1 ? "" : "s"} pulled`
            : action === "restrict" ? "Company restricted"
            : n ? `Restriction lifted, ${n} internship${n === 1 ? "" : "s"} restored` : "Restriction lifted",
        );
        setReloadKey((k) => k + 1);
        if (selected?._id === id) loadDetail(id);
    };

    const d = detail && selected && detail.id === selected._id ? detail.data : null;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, industry or slug..."
                    className={`${INPUT} w-full sm:max-w-sm`}
                />
                <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className={INPUT}>
                    <option value="">All statuses</option>
                    <option value="none">Active</option>
                    <option value="restricted">Restricted</option>
                    <option value="banned">Banned</option>
                </select>
            </div>

            {!loading && <p className="text-xs text-[var(--text-3)]">{total} compan{total === 1 ? "y" : "ies"}</p>}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /></div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-[var(--text-3)]">
                    <SearchX className="h-6 w-6" />
                    <p className="text-sm">No companies found</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <tr>
                                <th className={TH}>Company</th>
                                <th className={TH}>Industry</th>
                                <th className={`${TH} text-center`}>Members</th>
                                <th className={`${TH} text-center`}>Internships</th>
                                <th className={TH}>Status</th>
                                <th className={TH}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[var(--surface)]">
                            {rows.map((c) => (
                                <tr key={c._id} className="border-b border-[var(--border)] last:border-0">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar src={c.logo} name={c.name} size="sm" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[var(--text)] truncate">{c.name}</p>
                                                <p className="text-xs text-[var(--text-3)] truncate">{c.contactEmail}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)]">{c.industry}</td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)] text-center">{c.memberCount}</td>
                                    <td className="py-3 px-4 text-sm text-[var(--text-2)] text-center">{c.internshipCount}</td>
                                    <td className="py-3 px-4"><StatusBadge status={c.restriction.status} /></td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => setSelected(c)}>Details</Button>
                                            <Controls status={c.restriction.status} onAct={(a, r) => act(c._id, a, r)} />
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
                description={selected?.contactEmail}
            >
                {!d ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-3)]" /></div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <StatusBadge status={d.company.restriction.status} />
                                <Badge variant={d.company.verification?.status === "verified" ? "success" : "warning"}>
                                    {d.company.verification?.status ?? "unverified"}
                                </Badge>
                                {!d.company.isActive && <Badge variant="danger">Inactive</Badge>}
                            </div>
                            <Controls status={d.company.restriction.status} onAct={(a, r) => act(d.company._id, a, r)} />
                        </div>

                        {d.company.restriction.status !== "none" && (
                            <p className="mb-5 text-sm text-[var(--danger)]">
                                {d.company.restriction.status === "banned" ? "Banned" : "Restricted"} {when(d.company.restriction.at)}
                                {d.company.restriction.reason ? ` — ${d.company.restriction.reason}` : ""}
                            </p>
                        )}

                        <Section title="Company">
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <Field label="Name" value={d.company.name} />
                                <Field label="Legal name" value={d.company.legalName} />
                                <Field label="Slug" value={d.company.slug} />
                                <Field label="Industry" value={d.company.industry} />
                                <Field label="Type" value={d.company.companyType} />
                                <Field label="Size" value={d.company.size} />
                                <Field label="Founded" value={d.company.foundedYear} />
                                <Field label="Website" value={d.company.website} />
                                <Field label="Contact" value={[d.company.contactEmail, d.company.contactPhone].filter(Boolean).join(" · ")} />
                                <Field label="HQ" value={[d.company.headquarters?.city, d.company.headquarters?.state, d.company.headquarters?.country].filter(Boolean).join(", ")} />
                                <Field label="GSTIN" value={d.company.registration?.gstin} />
                                <Field label="CIN" value={d.company.registration?.cin} />
                                <Field label="PAN" value={d.company.registration?.pan} />
                                <Field label="Created" value={when(d.company.createdAt)} />
                                <Field label="Applications received" value={d.applications} />
                            </dl>
                            {d.company.description && (
                                <p className="mt-3 text-sm text-[var(--text-2)] whitespace-pre-wrap">{d.company.description}</p>
                            )}
                        </Section>

                        <Section title={`Members (${d.members.length})`}>
                            <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-sm)]">
                                {d.members.map((m) => (
                                    <li key={m.employerId} className="px-3 py-2 flex items-center gap-2 text-sm">
                                        <span className="font-medium text-[var(--text)]">{m.name}</span>
                                        <span className="text-xs text-[var(--text-3)] truncate">{m.email}</span>
                                        <span className="ml-auto flex items-center gap-1.5">
                                            {m.isBanned && <Badge variant="danger">banned</Badge>}
                                            <Badge variant="default">{m.role}</Badge>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Section>

                        <Section title={`Internships (${d.internships.length})`}>
                            {d.internships.length === 0 ? (
                                <p className="text-sm text-[var(--text-3)]">None.</p>
                            ) : (
                                <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-sm)] max-h-56 overflow-y-auto">
                                    {d.internships.map((i) => (
                                        <li key={i._id} className="px-3 py-2 flex items-center gap-2 text-sm">
                                            <span className="text-[var(--text)] truncate">{i.name}</span>
                                            <span className="ml-auto flex items-center gap-1.5 shrink-0">
                                                {i.bannedByCompany && <Badge variant="danger">pulled</Badge>}
                                                <Badge variant="default">{i.status}</Badge>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>

                        <Section title="Restriction history">
                            {d.history.length === 0 ? (
                                <p className="text-sm text-[var(--text-3)]">Nothing on record.</p>
                            ) : (
                                <ul className="space-y-1.5 text-sm">
                                    {d.history.map((h) => (
                                        <li key={h._id}>
                                            <Badge variant={h.action === "ban" ? "danger" : "success"}>{h.action === "ban" ? "applied" : "lifted"}</Badge>{" "}
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
