"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, Star, X } from "lucide-react";
import { toast } from "sonner";
import { APP_STATUS_LABEL, ApplicationStatusPill } from "@/components/employer/Pills";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { APPLICATION_TRANSITIONS, type ApplicationNote, type EmployerApplication, type ScreeningQuestion } from "@/types/employer";
import type { ParsedResumeData } from "@/types/resume";

interface Detail {
    application: EmployerApplication;
    student: { name: string; email: string; phone: string | null; city: string | null; profilePicture: string | null } | null;
    internship: { name: string; screeningQuestions: ScreeningQuestion[] } | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">{title}</h3>
            {children}
        </section>
    );
}

const show = (a: unknown) => (Array.isArray(a) ? a.join(", ") : typeof a === "boolean" ? (a ? "Yes" : "No") : String(a ?? "-"));

interface Props {
    companyId: string;
    applicationId: string | null;
    onClose: () => void;
    /** Called after any change so the table can refresh. */
    onChanged: () => void;
}

export function ApplicantDrawer({ companyId, applicationId, onClose, onChanged }: Props) {
    const url = `/api/employer/companies/${companyId}/applications/${applicationId}`;
    const [d, setD] = useState<Detail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [statusNote, setStatusNote] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        if (!applicationId) return;
        fetch(url, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => (j.success ? setD(j.data) : setError(j.error)))
            .catch(() => setError("Unable to load applicant"));
    }, [url, applicationId]);

    // The parent remounts the drawer per applicant (key), so state starts fresh
    useEffect(load, [load]);

    const send = async (fn: () => Promise<Response>, ok?: string) => {
        setBusy(true);
        try {
            const j = await (await fn()).json();
            if (!j.success) throw new Error(j.error);
            if (ok) toast.success(ok);
            load();
            onChanged();
            return j;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Request failed");
            return null;
        } finally {
            setBusy(false);
        }
    };
    const patch = (body: object) =>
        fetch(url, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    const app = d?.application;
    const parsed = (app?.resumeSnapshot.parsedData ?? null) as Partial<ParsedResumeData> | null;
    const next = app ? APPLICATION_TRANSITIONS[app.status] : [];

    return (
        <Dialog.Root open={!!applicationId} onOpenChange={(o) => !o && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-[var(--surface)] shadow-2xl focus:outline-none"
                >
                    <div className="flex items-start gap-3 border-b border-[var(--border)] p-4">
                        <Avatar src={d?.student?.profilePicture} name={d?.student?.name ?? "?"} size="lg" />
                        <div className="min-w-0 flex-1">
                            <Dialog.Title className="truncate text-base font-bold text-[var(--text)]">{d?.student?.name ?? "Applicant"}</Dialog.Title>
                            <p className="truncate text-xs text-[var(--text-3)]">{[d?.student?.email, d?.student?.phone, d?.student?.city].filter(Boolean).join(" · ")}</p>
                            {d && <p className="mt-1 text-xs text-[var(--text-2)]">For {d.internship?.name}</p>}
                        </div>
                        <Dialog.Close aria-label="Close" className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)]"><X className="h-4 w-4" /></Dialog.Close>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto p-4">
                        {error ? (
                            <p className="text-sm text-[var(--danger)]">{error}</p>
                        ) : !d || !app ? (
                            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
                        ) : (
                            <>
                                <Section title="Status">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <ApplicationStatusPill status={app.status} />
                                        {app.matchScore != null && <Badge variant="outline">{Math.round(app.matchScore * 100)}% match</Badge>}
                                    </div>
                                    {next.length > 0 ? (
                                        <>
                                            <input
                                                value={statusNote}
                                                onChange={(e) => setStatusNote(e.target.value)}
                                                maxLength={500}
                                                placeholder="Optional note for the history"
                                                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {next.map((s) => (
                                                    <Button
                                                        key={s}
                                                        size="sm"
                                                        variant={s === "rejected" ? "danger" : "secondary"}
                                                        disabled={busy}
                                                        onClick={async () => {
                                                            if (await send(() => patch({ status: s, note: statusNote }), `Moved to ${APP_STATUS_LABEL[s]}`)) setStatusNote("");
                                                        }}
                                                    >
                                                        {s === "under_review" && app.status === "rejected" ? "Undo reject" : APP_STATUS_LABEL[s]}
                                                    </Button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-xs text-[var(--text-3)]">{app.status === "withdrawn" ? "Withdrawn by the student." : "Final status."}</p>
                                    )}
                                </Section>

                                <Section title="Rating (internal)">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button
                                                key={n}
                                                disabled={busy}
                                                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                                                onClick={() => send(() => patch({ rating: n === app.rating ? null : n }))}
                                                className="p-0.5"
                                            >
                                                <Star className={cn("h-5 w-5", (app.rating ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-[var(--border-2)]")} />
                                            </button>
                                        ))}
                                    </div>
                                </Section>

                                <Section title="Resume (as submitted)">
                                    {app.resumeSnapshot.url ? (
                                        <a href={app.resumeSnapshot.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline">
                                            <ExternalLink className="h-4 w-4" /> Open resume
                                        </a>
                                    ) : <p className="text-sm text-[var(--text-3)]">No resume file.</p>}
                                    {app.resumeSnapshot.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">{app.resumeSnapshot.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
                                    )}
                                    {parsed?.summary && <p className="text-sm text-[var(--text-2)]">{parsed.summary}</p>}
                                    {!!parsed?.education?.length && (
                                        <ul className="text-sm text-[var(--text)] space-y-0.5">
                                            {parsed.education.map((e, i) => <li key={i}>{e.institution}{e.field?.course ? `, ${e.field.course}` : ""}</li>)}
                                        </ul>
                                    )}
                                    {!!parsed?.workHistory?.length && (
                                        <ul className="text-sm text-[var(--text)] space-y-0.5">
                                            {parsed.workHistory.map((w, i) => <li key={i}>{w.title} at {w.company}</li>)}
                                        </ul>
                                    )}
                                    {!!parsed?.projects?.length && <p className="text-sm text-[var(--text-2)]">Projects: {parsed.projects.map((p) => p.title).join(", ")}</p>}
                                </Section>

                                {app.coverLetter && (
                                    <Section title="Cover letter"><p className="whitespace-pre-line text-sm text-[var(--text)]">{app.coverLetter}</p></Section>
                                )}

                                {app.answers.length > 0 && (
                                    <Section title="Screening answers">
                                        <dl className="space-y-2">
                                            {app.answers.map((a) => (
                                                <div key={a.questionId}>
                                                    <dt className="text-xs text-[var(--text-3)]">{d.internship?.screeningQuestions.find((q) => q._id === a.questionId)?.question ?? "Question removed"}</dt>
                                                    <dd className="text-sm text-[var(--text)]">{show(a.answer)}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </Section>
                                )}

                                <Section title="History">
                                    <ol className="space-y-1.5 border-l border-[var(--border)] pl-3">
                                        {[...app.statusHistory].reverse().map((h, i) => (
                                            <li key={i} className="text-sm">
                                                <span className="font-medium text-[var(--text)]">{APP_STATUS_LABEL[h.status]}</span>
                                                <span className="text-xs text-[var(--text-3)]"> · {fmt(h.changedAt)}</span>
                                                {h.note && <p className="text-xs text-[var(--text-2)]">{h.note}</p>}
                                            </li>
                                        ))}
                                    </ol>
                                </Section>

                                <Section title="Internal notes">
                                    <p className="text-xs text-[var(--text-3)]">Only your team can see these. Students never do.</p>
                                    {app.notes.map((n: ApplicationNote) => (
                                        <div key={n._id} className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2.5">
                                            <p className="whitespace-pre-line text-sm text-[var(--text)]">{n.text}</p>
                                            <p className="mt-1 text-[11px] text-[var(--text-3)]">{n.authorName} · {fmt(n.createdAt)}</p>
                                        </div>
                                    ))}
                                    <textarea
                                        rows={2}
                                        maxLength={2000}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Add a note…"
                                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                                    />
                                    <Button
                                        size="sm"
                                        disabled={busy || !note.trim()}
                                        onClick={async () => {
                                            const ok = await send(() => fetch(`${url}/notes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: note }) }));
                                            if (ok) setNote("");
                                        }}
                                    >
                                        Add note
                                    </Button>
                                </Section>
                            </>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
