"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, ScanSearch, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { ModerationRejectModal } from "./ModerationRejectModal";
import type { AnalyzeKind, PipelineResult } from "@/lib/moderator/analyze";

const KINDS: { value: AnalyzeKind; label: string }[] = [
    { value: "live", label: "Published (scraped)" },
    { value: "staged", label: "Moderation queue" },
    { value: "employer", label: "Employer-posted" },
];
const STATUSES = [
    { value: "", label: "Any status" },
    { value: "pending_review", label: "Pending review" },
    { value: "auto_approved", label: "Auto approved" },
    { value: "manually_approved", label: "Manually approved" },
    { value: "auto_rejected", label: "Auto rejected" },
    { value: "manually_rejected", label: "Manually rejected" },
];

interface Row {
    _id: string; kind: AnalyzeKind; name: string; company: string; source: string; isActive?: boolean;
    moderation?: { status?: string; score?: number | null };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the stored document is shown as-is, field by field */
type Doc = Record<string, any> & { _id: string; kind: AnalyzeKind; hasVectors: boolean; companyRecord?: any; applicationCount?: number | null };

const statusVariant = (s?: string) =>
    s?.includes("approved") ? "success" : s?.includes("rejected") ? "danger" : s === "pending_review" ? "warning" : "secondary";
const label = (s?: string | null) => (s ?? "—").replace(/_/g, " ");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="plasma-card p-4 sm:p-5">
            <h3 className="label mb-3 pb-2 border-b border-[var(--border)]">{title}</h3>
            {children}
        </section>
    );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] text-[var(--text-3)]">{k}</dt>
            <dd className="text-[13px] font-medium text-[var(--text)] break-words">{v ?? "—"}</dd>
        </div>
    );
}

const Facts = ({ children }: { children: React.ReactNode }) => <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">{children}</dl>;
const chips = (items?: string[] | null, variant: "secondary" | "success" | "warning" = "secondary") =>
    items?.length ? <div className="flex flex-wrap gap-1.5">{items.map((x) => <Badge key={x} variant={variant}>{x}</Badge>)}</div> : <span className="text-[var(--text-3)]">—</span>;

const stipendText = (s: any) =>
    !s ? "—" : s.type === "paid" ? `${s.currency === "USD" ? "$" : "₹"}${Number(s.amount ?? 0).toLocaleString("en-IN")}${s.period ? ` / ${s.period}` : ""}` : s.type;
const placeText = (d: Doc) =>
    d.isRemote ? "Work from home" : (d.address ?? []).map((a: any) => [a.city, a.state].filter(Boolean).join(", ")).filter(Boolean).join(" · ") || "—";

function RiskBars({ breakdown }: { breakdown?: Record<string, number | null> | null }) {
    const entries = Object.entries(breakdown ?? {}).filter(([, v]) => typeof v === "number") as [string, number][];
    if (!entries.length) return <p className="text-xs text-[var(--text-3)]">No risk breakdown recorded.</p>;
    return (
        <div className="space-y-2">
            {entries.map(([k, v]) => (
                <div key={k}>
                    <div className="flex justify-between text-[11px] text-[var(--text-2)]"><span>{k.replace(/([A-Z])/g, " $1").toLowerCase()}</span><span>{Math.round(v * 100) / 100}</span></div>
                    <div className="h-1.5 bg-[var(--surface-3)] rounded-[var(--radius-xl)] overflow-hidden">
                        <div className={cn("h-full", v > 0.66 ? "bg-[var(--danger)]" : v > 0.33 ? "bg-[var(--warning)]" : "bg-[var(--success)]")} style={{ width: `${Math.min(Math.max(v, 0), 1) * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ScamDetails({ sd, score }: { sd: any; score?: number | null }) {
    if (!sd) return <p className="text-sm text-[var(--text-3)]">No scam-detection result stored for this internship. Use “Re-run pipeline”.</p>;
    return (
        <div className="space-y-4">
            <Facts>
                <Fact k="Decision" v={<Badge variant={sd.decision === "clear" ? "success" : sd.decision === "block" ? "danger" : "warning"}>{sd.decision}</Badge>} />
                <Fact k="Score (higher = riskier)" v={score ?? sd.score} />
                <Fact k="Confidence" v={typeof sd.confidence === "number" ? `${Math.round(sd.confidence * 100)}%` : "—"} />
                <Fact k="Evaluated" v={sd.evaluatedAt ? formatDate(sd.evaluatedAt) : "—"} />
            </Facts>
            {sd.explanationSummary && <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{sd.explanationSummary}</p>}
            <div><p className="text-[11px] text-[var(--text-3)] mb-1.5">Flags</p>{chips(sd.scamFlags, "warning")}</div>
            <div><p className="text-[11px] text-[var(--text-3)] mb-1.5">Risk breakdown</p><RiskBars breakdown={sd.riskBreakdown} /></div>
        </div>
    );
}

function Rescan({ data }: { data: { persisted: boolean; previous: { status: string | null; score: number | null }; analysis: PipelineResult } }) {
    const { analysis, previous, persisted } = data;
    const r = analysis.result;
    return (
        <Section title="Pipeline re-run result">
            <div className="space-y-4">
                <ol className="space-y-2">
                    {analysis.stages.map((s) => (
                        <li key={s.stage} className="flex items-start gap-3">
                            <span className={cn("mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded-[var(--radius-xl)] text-white text-[10px] font-bold",
                                s.status === "failed" || s.status === "error" || s.status === "auto_rejected" ? "bg-[var(--danger)]" : s.status === "pending_review" ? "bg-[var(--warning)]" : "bg-[var(--success)]")}>
                                {s.status === "failed" || s.status === "error" ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-[var(--heading)] capitalize">{s.stage} <span className="font-normal text-[var(--text-3)]">· {label(s.status)}{s.seconds ? ` · ${s.seconds}s` : ""}</span></p>
                                {s.detail && <p className="text-xs text-[var(--text-2)]">{s.detail}</p>}
                                {!!s.rules?.length && <div className="mt-1.5">{chips(s.rules, "warning")}</div>}
                            </div>
                        </li>
                    ))}
                </ol>
                {r.outcome === "scored" && (
                    <Facts>
                        <Fact k="Stored status" v={label(previous.status)} />
                        <Fact k="Pipeline verdict now" v={<Badge variant={statusVariant(r.moderationStatus)}>{label(r.moderationStatus)}</Badge>} />
                        <Fact k="Score before → now" v={`${previous.score ?? "—"} → ${r.score}`} />
                        <Fact k="Low confidence forced review" v={r.lowConfidence ? "yes" : "no"} />
                        <Fact k="Hard disqualified" v={r.hardDisqualified ? "yes" : "no"} />
                        <Fact k="Fingerprint" v={<span className="font-mono text-[11px]">{r.scamDetails ? (r as any).fingerprint?.slice(0, 16) : "—"}</span>} />
                    </Facts>
                )}
                <p className="text-xs text-[var(--text-3)]">
                    {persisted ? "Scam-detection fields on this internship were refreshed. Its approval status was NOT changed — use Approve / Reject." : "Nothing was saved (the pipeline did not produce a usable verdict)."}
                </p>
            </div>
        </Section>
    );
}

function Detail({ row, onBack, onChanged }: { row: { kind: AnalyzeKind; id: string }; onBack: () => void; onChanged: () => void }) {
    const [doc, setDoc] = useState<Doc | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<"approve" | "reject" | "rescan" | null>(null);
    const [rejecting, setRejecting] = useState(false);
    const [rescan, setRescan] = useState<{ persisted: boolean; previous: { status: string | null; score: number | null }; analysis: PipelineResult } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/moderator/analyze/${row.kind}/${row.id}`, { credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Failed to load");
            setDoc(json.data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        }
    }, [row.kind, row.id]);

    useEffect(() => { setDoc(null); setRescan(null); load(); }, [load]);

    const decide = async (action: "approve" | "reject", rejectionReason?: string) => {
        setBusy(action);
        try {
            const res = await fetch(`/api/moderator/internships/${row.id}`, {
                method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, rejectionReason, ...(row.kind === "employer" ? { source: "employer" } : row.kind === "live" ? { source: "live" } : {}) }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error ?? `${action} failed`);
            toast.success(action === "approve" ? "Approved" : "Rejected");
            await load();
            onChanged();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `${action} failed`);
        } finally {
            setBusy(null);
        }
    };

    const rerun = async () => {
        setBusy("rescan");
        try {
            const res = await fetch(`/api/moderator/analyze/${row.kind}/${row.id}/rescan`, { method: "POST", credentials: "include" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error ?? "Pipeline re-run failed");
            setRescan(json);
            if (json.persisted) { await load(); onChanged(); }
            toast.success("Pipeline re-run complete");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Pipeline re-run failed");
        } finally {
            setBusy(null);
        }
    };

    if (error) return <div className="plasma-card p-8 text-center text-sm text-[var(--danger)]">{error}</div>;
    if (!doc) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" /></div>;

    const m = doc.moderation ?? {};
    const lv = doc.linkVerification;
    const approved = m.status === "auto_approved" || m.status === "manually_approved";
    const rejected = m.status === "auto_rejected" || m.status === "manually_rejected";

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="lg:hidden inline-flex items-center gap-1.5 label hover:text-[var(--primary)]"><ArrowLeft className="h-3.5 w-3.5" /> Back to list</button>

            <div className="plasma-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold leading-snug text-[var(--heading)]">{doc.name}</h2>
                        <p className="text-sm text-[var(--text-2)]">{doc.company} · {doc.source}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge variant={statusVariant(m.status)}>{label(m.status)}</Badge>
                            <Badge variant="outline">{KINDS.find((k) => k.value === doc.kind)?.label}</Badge>
                            <Badge variant={doc.isActive === false ? "danger" : "success"}>{doc.isActive === false ? "inactive" : "active"}</Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={rerun} loading={busy === "rescan"} disabled={!!busy}><RefreshCw className="h-3.5 w-3.5" /> Re-run pipeline</Button>
                        <Button size="sm" variant="outline" onClick={() => decide("approve")} loading={busy === "approve"} disabled={!!busy || approved}><Check className="h-3.5 w-3.5" /> Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => setRejecting(true)} loading={busy === "reject"} disabled={!!busy || rejected}><X className="h-3.5 w-3.5" /> Reject</Button>
                    </div>
                </div>
            </div>

            {rescan && <Rescan data={rescan} />}

            <Section title="As students see it">
                <Facts>
                    <Fact k="Stipend" v={stipendText(doc.stipend)} />
                    <Fact k="Duration" v={doc.duration ? `${doc.duration.value} ${doc.duration.unit}` : "—"} />
                    <Fact k="Location" v={placeText(doc)} />
                    <Fact k="Published" v={doc.datePublished ? formatDate(doc.datePublished) : "—"} />
                    <Fact k="Deadline" v={doc.deadlineDate ? formatDate(doc.deadlineDate) : "—"} />
                    <Fact k="Openings" v={doc.openings} />
                    {doc.applyLink && <Fact k="Apply link" v={<a href={doc.applyLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline break-all">{doc.applyLink.slice(0, 48)}<ExternalLink className="h-3 w-3 shrink-0" /></a>} />}
                    {doc.kind === "employer" && <Fact k="Work mode" v={doc.workMode} />}
                    {doc.kind === "employer" && <Fact k="Applications received" v={doc.applicationCount} />}
                </Facts>
                {doc.summary && <p className="mt-4 text-[13px] leading-relaxed text-[var(--text)] whitespace-pre-line">{doc.summary}</p>}
                {!!doc.responsibilities?.length && <ul className="mt-3 list-disc pl-5 space-y-1 text-[13px] text-[var(--text)]">{doc.responsibilities.map((r: string) => <li key={r}>{r}</li>)}</ul>}
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    <div><p className="text-[11px] text-[var(--text-3)] mb-1.5">Skills</p>{chips(doc.skills)}</div>
                    <div><p className="text-[11px] text-[var(--text-3)] mb-1.5">Perks</p>{chips(doc.perks, "success")}</div>
                </div>
                {doc.kind === "employer" && !!doc.screeningQuestions?.length && (
                    <div className="mt-4"><p className="text-[11px] text-[var(--text-3)] mb-1.5">Screening questions</p>
                        <ol className="list-decimal pl-5 space-y-1 text-[13px] text-[var(--text)]">{doc.screeningQuestions.map((q: any) => <li key={q._id}>{q.question} <span className="text-[var(--text-3)]">({q.type}{q.required ? ", required" : ""})</span></li>)}</ol>
                    </div>
                )}
            </Section>

            {doc.companyRecord && (
                <Section title="Company">
                    <Facts>
                        <Fact k="Name" v={doc.companyRecord.name} />
                        <Fact k="Verification" v={<Badge variant={doc.companyRecord.verification?.status === "verified" ? "success" : "warning"}>{doc.companyRecord.verification?.status ?? "unverified"}</Badge>} />
                        <Fact k="Active" v={doc.companyRecord.isActive === false ? "no" : "yes"} />
                    </Facts>
                </Section>
            )}

            <Section title="Moderation pipeline">
                <Facts>
                    <Fact k="Status" v={<Badge variant={statusVariant(m.status)}>{label(m.status)}</Badge>} />
                    <Fact k="Origin" v={label(m.source)} />
                    <Fact k="Score" v={m.score ?? "—"} />
                    <Fact k="Reviewed by" v={m.reviewedBy ?? "automatic"} />
                    <Fact k="Reviewed at" v={m.reviewedAt ? formatDate(m.reviewedAt) : "—"} />
                    <Fact k="Rejection reason" v={m.rejectionReason} />
                </Facts>
                <div className="mt-4"><p className="text-[11px] text-[var(--text-3)] mb-1.5">Flags</p>{chips(m.flags, "warning")}</div>
            </Section>

            <Section title="Scam detection"><ScamDetails sd={m.scamDetails} score={m.score} /></Section>

            <Section title="Link verification">
                {lv ? (
                    <Facts>
                        <Fact k="Reachable" v={lv.reachable === null ? "unknown" : lv.reachable ? "yes" : "no"} />
                        <Fact k="HTTP status" v={lv.statusCode} />
                        <Fact k="Redirected to" v={lv.redirectedTo} />
                        <Fact k="Scam suspected" v={lv.isScamSuspected === null ? "unknown" : lv.isScamSuspected ? "yes" : "no"} />
                        <Fact k="Expired" v={lv.isExpired === null ? "unknown" : lv.isExpired ? "yes" : "no"} />
                        <Fact k="Checked" v={lv.checkedAt ? formatDate(lv.checkedAt) : "—"} />
                        <div className="col-span-full"><p className="text-[11px] text-[var(--text-3)] mb-1.5">Signals</p>{chips(lv.scamSignals, "warning")}</div>
                    </Facts>
                ) : <p className="text-sm text-[var(--text-3)]">No link verification stored.</p>}
            </Section>

            <Section title="Indexing & record">
                <Facts>
                    <Fact k="Vectors stored" v={doc.hasVectors ? "yes (in the recommendation graph)" : "no"} />
                    <Fact k="Vectorized at" v={doc.vectorizedAt ? formatDate(doc.vectorizedAt) : "—"} />
                    <Fact k="Fingerprint" v={<span className="font-mono text-[11px] break-all">{doc.fingerprint?.slice(0, 20) ?? "—"}</span>} />
                    <Fact k="Created" v={doc.createdAt ? formatDate(doc.createdAt) : "—"} />
                    <Fact k="Updated" v={doc.updatedAt ? formatDate(doc.updatedAt) : "—"} />
                    <Fact k="Id" v={<span className="font-mono text-[11px] break-all">{doc._id}</span>} />
                </Facts>
            </Section>

            <ModerationRejectModal
                open={rejecting}
                internshipName={doc.name}
                onClose={() => setRejecting(false)}
                onConfirm={(reason) => { setRejecting(false); decide("reject", reason); }}
            />
        </div>
    );
}

export function AnalyzePanel({ initial }: { initial?: { kind: AnalyzeKind; id: string } | null }) {
    const [kind, setKind] = useState<AnalyzeKind>(initial?.kind ?? "live");
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<Row[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<{ kind: AnalyzeKind; id: string } | null>(initial ?? null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const p = new URLSearchParams({ kind, page: String(page), limit: "20" });
                if (status) p.set("status", status);
                if (debounced) p.set("search", debounced);
                const res = await fetch(`/api/moderator/analyze?${p}`, { credentials: "include" });
                if (!res.ok) throw new Error();
                const json = await res.json();
                if (cancelled) return;
                setRows(json.data ?? []); setTotal(json.total ?? 0); setTotalPages(json.totalPages ?? 1);
            } catch {
                if (!cancelled) toast.error("Failed to load internships");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [kind, status, debounced, page, reload]);

    const pick = (k: AnalyzeKind) => { setKind(k); setPage(1); };

    return (
        <div className="grid lg:grid-cols-[minmax(300px,380px)_1fr] gap-5 items-start">
            {/* List */}
            <div className={cn("space-y-3", selected && "hidden lg:block")}>
                <div className="flex flex-wrap gap-1.5">
                    {KINDS.map(({ value, label: l }) => (
                        <button key={value} onClick={() => pick(value)} className={cn("pill", kind === value && "!bg-[var(--primary)] !text-white !border-[var(--primary)]")}>{l}</button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or company…" className="col-span-2 px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--primary)]" />
                    <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="col-span-2 px-3 py-2 text-[13px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
                <p className="text-xs text-[var(--text-3)]">{loading ? "Loading…" : `${total.toLocaleString("en-IN")} internships`}</p>

                <ul className="space-y-1.5">
                    {rows.map((r) => (
                        <li key={r._id}>
                            <button
                                onClick={() => setSelected({ kind: r.kind, id: r._id })}
                                className={cn("w-full text-left plasma-card !shadow-none px-3 py-2.5 hover:border-[var(--primary)]", selected?.id === r._id && "!border-[var(--primary)] bg-[var(--primary-bg)]")}
                            >
                                <p className="text-[13px] font-semibold text-[var(--heading)] line-clamp-1">{r.name}</p>
                                <p className="text-[11.5px] text-[var(--text-3)] line-clamp-1">{r.company}</p>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <Badge variant={statusVariant(r.moderation?.status)}>{label(r.moderation?.status)}</Badge>
                                    {r.moderation?.score != null && <span className="font-mono text-[10.5px] text-[var(--text-3)]">score {r.moderation.score}</span>}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
                {!loading && rows.length === 0 && <p className="text-sm text-[var(--text-3)] py-6 text-center">No internships match.</p>}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                        <span className="label">{page} / {totalPages}</span>
                        <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                    </div>
                )}
            </div>

            {/* Detail */}
            <div className={cn("min-w-0", !selected && "hidden lg:block")}>
                {selected ? (
                    <Detail key={selected.id} row={selected} onBack={() => setSelected(null)} onChanged={() => setReload((n) => n + 1)} />
                ) : (
                    <div className="plasma-card p-12 text-center">
                        <ScanSearch className="h-8 w-8 mx-auto text-[var(--text-3)] mb-3" />
                        <p className="text-sm text-[var(--text-2)]">Pick an internship to see everything the pipeline knows about it.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
