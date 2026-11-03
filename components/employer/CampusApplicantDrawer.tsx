"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Star, X } from "lucide-react";
import { toast } from "sonner";
import { CAMPUS_STATUS_LABEL, CampusApplicationPill } from "@/components/campus/CampusApplicationPill";
import { controlCls } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeHref } from "@/lib/safeUrl";
import { CAMPUS_APPLICATION_TRANSITIONS, CAMPUS_ROUND_RESULTS, type CampusApplicationStatus } from "@/types/campus";

interface Detail {
    _id: string;
    status: CampusApplicationStatus;
    entityId: string;
    internshipId: string;
    applicantSnapshot: { name: string; uid: string; course: string; department: string; batch: number; cgpa?: number | null; activeBacklogs?: number | null; phone?: string | null; email: string };
    resumeSnapshot: { url: string | null; skills: string[] };
    coverLetter?: string | null;
    answers: { question: string; answer: string }[];
    rounds: { name: string; result: string; note?: string | null }[];
    statusHistory: { status: CampusApplicationStatus; changedAt: string; byStudent?: boolean; note?: string | null }[];
    notes: { _id: string; text: string; createdAt: string }[];
    rating?: number | null;
    removal?: { reason?: string | null } | null;
    internship: { company: string; designation: string; rounds: string[] } | null;
    studentId: string;
}

interface Props {
    entityId: string;
    applicationId: string;
    canEdit: boolean;
    onClose: () => void;
    onChanged: () => void;
}

// Staff moves: the transition map minus remove (own button), reinstate (own button) and student-only outcomes
const STAFF_MOVES: CampusApplicationStatus[] = ["shortlisted", "in_process", "offered", "rejected"];

async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return (await res.json().catch(() => ({ success: false, error: "Something went wrong" }))) as { success: boolean; error?: string; data?: unknown };
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function CampusApplicantDrawer({ entityId, applicationId, canEdit, onClose, onChanged }: Props) {
    const base = `/api/employer/campus/${entityId}`;
    const [d, setD] = useState<Detail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<"remove" | "ban" | "remove-campus" | null>(null);
    const [reason, setReason] = useState("");
    const [alsoRemove, setAlsoRemove] = useState(true);
    const [round, setRound] = useState({ name: "", result: "cleared" });

    const load = useCallback(async () => {
        const j = await send(`${base}/applications/${applicationId}`, "GET");
        if (j.success) { setD(j.data as Detail); setError(null); } else setError(j.error ?? "Unable to load");
    }, [base, applicationId]);
    useEffect(() => {
        let live = true;
        send(`${base}/applications/${applicationId}`, "GET").then((j) => { if (!live) return; if (j.success) setD(j.data as Detail); else setError(j.error ?? "Unable to load"); });
        return () => { live = false; };
    }, [base, applicationId]);

    const act = async (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
        setBusy(true);
        const j = await fn();
        setBusy(false);
        if (!j.success) return toast.error(j.error ?? "Failed");
        toast.success(ok);
        setDialog(null);
        setReason("");
        await load();
        onChanged();
    };

    const patch = (body: unknown, ok: string) => act(() => send(`${base}/applications/${applicationId}`, "PATCH", body), ok);
    const next = d ? STAFF_MOVES.filter((s) => CAMPUS_APPLICATION_TRANSITIONS[d.status].includes(s)) : [];

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-[var(--overlay)]" onClick={onClose}>
            <aside className="h-full w-full max-w-lg overflow-y-auto bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()} aria-label="Applicant">
                <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-[var(--heading)]">{d?.applicantSnapshot.name ?? "Applicant"}</h2>
                        {d?.internship && <p className="text-xs text-[var(--text-3)]">{d.internship.company} · {d.internship.designation}</p>}
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-1 text-[var(--text-3)] hover:text-[var(--text)]"><X className="h-5 w-5" /></button>
                </div>

                {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : !d ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-32" /></div> : (
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <CampusApplicationPill status={d.status} />
                            {d.removal?.reason && <span className="text-xs text-[var(--text-3)]">Reason: {d.removal.reason}</span>}
                        </div>

                        <section className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-sm space-y-1">
                            <p><span className="text-[var(--text-3)]">ID:</span> <span className="font-mono">{d.applicantSnapshot.uid}</span></p>
                            <p>{d.applicantSnapshot.course} · {d.applicantSnapshot.department} · Batch {d.applicantSnapshot.batch}</p>
                            <p>CGPA {d.applicantSnapshot.cgpa ?? "-"} · Backlogs {d.applicantSnapshot.activeBacklogs ?? "-"}</p>
                            <p>{d.applicantSnapshot.email}{d.applicantSnapshot.phone ? ` · ${d.applicantSnapshot.phone}` : ""}</p>
                            {d.resumeSnapshot.url && <a href={safeHref(d.resumeSnapshot.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Resume</a>}
                        </section>

                        {d.coverLetter && <section><h3 className="label mb-1">Cover letter</h3><p className="whitespace-pre-line text-sm text-[var(--text)]">{d.coverLetter}</p></section>}
                        {d.answers.length > 0 && (
                            <section><h3 className="label mb-1">Screening answers</h3>
                                <dl className="space-y-2 text-sm">{d.answers.map((a, i) => <div key={i}><dt className="text-[var(--text-3)]">{a.question}</dt><dd className="text-[var(--text)]">{a.answer}</dd></div>)}</dl>
                            </section>
                        )}

                        {canEdit && (
                            <section className="space-y-3">
                                <h3 className="label">Actions</h3>
                                <div className="flex flex-wrap gap-2">
                                    {next.map((s) => <Button key={s} size="sm" variant={s === "rejected" ? "danger" : "secondary"} disabled={busy} onClick={() => patch({ status: s }, `Moved to ${CAMPUS_STATUS_LABEL[s]}`)}>{CAMPUS_STATUS_LABEL[s]}</Button>)}
                                    {d.status === "removed" && <Button size="sm" disabled={busy} onClick={() => act(() => send(`${base}/applications/${applicationId}/reinstate`, "POST"), "Reinstated")}>Reinstate</Button>}
                                    {CAMPUS_APPLICATION_TRANSITIONS[d.status].includes("removed") && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDialog("remove")}>Remove from internship</Button>}
                                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDialog("ban")}>Bar from campus internships</Button>
                                </div>
                                <div className="flex items-center gap-1" aria-label="Rating">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => patch({ rating: d.rating === n ? null : n }, "Rating saved")} className="p-0.5">
                                            <Star className={`h-5 w-5 ${d.rating && n <= d.rating ? "fill-amber-400 text-amber-400" : "text-[var(--text-3)]"}`} />
                                        </button>
                                    ))}
                                    <span className="ml-2 text-xs text-[var(--text-3)]">Only staff see this</span>
                                </div>
                            </section>
                        )}

                        <section className="space-y-2">
                            <h3 className="label">Selection rounds</h3>
                            {d.rounds.length === 0 ? <p className="text-xs text-[var(--text-3)]">No round results yet.</p> : (
                                <ul className="text-sm">{d.rounds.map((r) => <li key={r.name} className="flex justify-between"><span>{r.name}</span><span className="capitalize text-[var(--text-2)]">{r.result}</span></li>)}</ul>
                            )}
                            {canEdit && (
                                <div className="flex flex-wrap gap-2">
                                    <input className={`${controlCls} !w-auto flex-1`} list="round-names" placeholder="Round" value={round.name} maxLength={80} onChange={(e) => setRound({ ...round, name: e.target.value })} aria-label="Round name" />
                                    <datalist id="round-names">{(d.internship?.rounds ?? []).map((r) => <option key={r} value={r} />)}</datalist>
                                    <select className={`${controlCls} !w-auto`} value={round.result} onChange={(e) => setRound({ ...round, result: e.target.value })} aria-label="Round result">
                                        {CAMPUS_ROUND_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <Button size="sm" variant="secondary" disabled={busy || !round.name.trim()} onClick={() => patch({ round }, "Round saved").then(() => setRound({ ...round, name: "" }))}>Save</Button>
                                </div>
                            )}
                        </section>

                        <section className="space-y-2">
                            <h3 className="label">Staff notes <span className="normal-case text-[var(--text-3)]">(never shown to the student)</span></h3>
                            {d.notes.map((n) => <p key={n._id} className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-sm"><span className="block text-xs text-[var(--text-3)]">{fmt(n.createdAt)}</span>{n.text}</p>)}
                            {canEdit && (
                                <div className="flex gap-2">
                                    <input className={controlCls} value={note} maxLength={2000} placeholder="Add a note" onChange={(e) => setNote(e.target.value)} aria-label="Note" />
                                    <Button size="sm" variant="secondary" disabled={busy || !note.trim()} onClick={() => act(() => send(`${base}/applications/${applicationId}/notes`, "POST", { text: note }), "Note added").then(() => setNote(""))}>Add</Button>
                                </div>
                            )}
                        </section>

                        <section>
                            <h3 className="label mb-1">History</h3>
                            <ol className="space-y-1 text-xs text-[var(--text-2)]">{[...d.statusHistory].reverse().map((h, i) => <li key={i}>{fmt(h.changedAt)} · {CAMPUS_STATUS_LABEL[h.status]}{h.byStudent ? " (student)" : ""}{h.note ? ` · ${h.note}` : ""}</li>)}</ol>
                        </section>
                    </div>
                )}

                <Modal open={dialog === "remove" || dialog === "ban"} onClose={() => setDialog(null)} title={dialog === "ban" ? "Bar this student from campus internships?" : "Remove from this internship?"} size="sm">
                    <p className="mb-3 text-sm text-[var(--text-2)]">
                        {dialog === "ban"
                            ? "They won't be able to apply to any internship of this campus until you lift it. They are told the reason. You can unban from the Blacklist."
                            : "This is not a ban: they can still apply to other internships. They can't re-apply to this one unless you reinstate them."}
                    </p>
                    <textarea className={controlCls} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dialog === "ban" ? "Reason (required, the student sees it)" : "Reason (optional)"} aria-label="Reason" />
                    {dialog === "ban" && (
                        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={alsoRemove} onChange={(e) => setAlsoRemove(e.target.checked)} className="accent-[var(--campus)]" /> Also remove them from their other open applications here</label>
                    )}
                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
                        {dialog === "ban" ? (
                            <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => act(() => send(`${base}/blacklist`, "POST", { studentId: d?.studentId, reason, removeOpen: alsoRemove }), "Student barred")}>Bar student</Button>
                        ) : (
                            <Button variant="danger" loading={busy} onClick={() => act(() => send(`${base}/applications/${applicationId}/remove`, "POST", { reason }), "Removed")}>Remove</Button>
                        )}
                    </div>
                </Modal>
            </aside>
        </div>
    );
}
