"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { controlCls, Field } from "@/components/employer/CompanyForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toIsoInput, toLocalInput } from "@/lib/campus/datetime";
import { CAMPUS_EVENT_MODES, CAMPUS_EVENT_TYPES } from "@/types/campus";

export interface InternshipOption { id: string; label: string; rounds: string[] }

interface EventRow {
    _id: string;
    internshipId: string | null;
    type: string;
    title: string;
    body: string;
    startsAt: string | null;
    endsAt: string | null;
    deadlineAt: string | null;
    mode: string;
    venue: string | null;
    link: string | null;
    audience: string;
    notify: { email: boolean; sms: boolean };
    status: "scheduled" | "cancelled" | "done";
    version: number;
}

interface Form {
    type: string; title: string; body: string; internshipId: string; startsAt: string; endsAt: string; deadlineAt: string;
    mode: string; venue: string; link: string; audienceKind: string; audienceValue: string; email: boolean; sms: boolean;
}

const TYPE_LABEL: Record<string, string> = {
    announcement: "Announcement", instruction: "Instruction", form: "Form", pre_placement_talk: "Pre-placement talk", online_assessment: "Online assessment",
    group_discussion: "Group discussion", technical_interview: "Technical interview", hr_interview: "HR interview", result: "Result", offer: "Offer", deadline: "Deadline", other: "Other",
};
const EMPTY: Form = { type: "announcement", title: "", body: "", internshipId: "", startsAt: "", endsAt: "", deadlineAt: "", mode: "online", venue: "", link: "", audienceKind: "all_members", audienceValue: "", email: true, sms: false };

const audienceOf = (f: Form) => (f.audienceKind === "round" ? `round:${f.audienceValue}` : f.audienceKind === "batch" ? `batch:${f.audienceValue}` : f.audienceKind);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : null);

function toForm(e: EventRow): Form {
    const [kind, ...rest] = e.audience.split(":");
    return {
        type: e.type, title: e.title, body: e.body, internshipId: e.internshipId ?? "", startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), deadlineAt: toLocalInput(e.deadlineAt),
        mode: e.mode, venue: e.venue ?? "", link: e.link ?? "", audienceKind: kind, audienceValue: rest.join(":"), email: e.notify.email, sms: e.notify.sms,
    };
}

function audienceLabel(a: string): string {
    if (a === "all_members") return "All students";
    if (a === "eligible") return "Eligible students";
    if (a === "applicants") return "Applicants";
    if (a === "shortlisted") return "Shortlisted";
    if (a.startsWith("round:")) return `Round: ${a.slice(6)}`;
    if (a.startsWith("batch:")) return `Batch ${a.slice(6)}`;
    return a;
}

/** Events of a campus (or of one internship): create, edit, cancel. Announced events tell their audience. */
export function CampusEventsManager({ entityId, internshipId, canEdit, internships }: { entityId: string; internshipId?: string; canEdit: boolean; internships: InternshipOption[] }) {
    const base = `/api/employer/campus/${entityId}/events`;
    const [items, setItems] = useState<EventRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
    const [busy, setBusy] = useState(false);
    const [cancelling, setCancelling] = useState<EventRow | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let live = true;
        fetch(internshipId ? `${base}?internshipId=${internshipId}` : base, { credentials: "include" }).then((r) => r.json())
            .then((j) => { if (!live) return; if (j.success) { setItems(j.data); setError(null); } else setError(j.error); })
            .catch(() => live && setError("Unable to load events"));
        return () => { live = false; };
    }, [base, internshipId, tick]);
    const reload = useCallback(() => setTick((t) => t + 1), []);

    const open = (e?: EventRow) => setEditing({ id: e?._id ?? null, form: e ? toForm(e) : { ...EMPTY, internshipId: internshipId ?? "" } });
    const f = editing?.form;
    const set = (patch: Partial<Form>) => setEditing((s) => (s ? { ...s, form: { ...s.form, ...patch } } : s));
    const rounds = internships.find((i) => i.id === (f?.internshipId || internshipId))?.rounds ?? [];

    const save = async () => {
        if (!editing || !f) return;
        setBusy(true);
        const body = {
            type: f.type, title: f.title, body: f.body, internshipId: f.internshipId || null,
            startsAt: toIsoInput(f.startsAt), endsAt: toIsoInput(f.endsAt), deadlineAt: toIsoInput(f.deadlineAt),
            mode: f.mode, venue: f.venue, link: f.link, audience: audienceOf(f), notify: { email: f.email, sms: f.sms },
        };
        const res = await fetch(editing.id ? `${base}/${editing.id}` : base, { method: editing.id ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to save" }));
        setBusy(false);
        if (!j.success) return toast.error(j.error);
        toast.success(editing.id ? (j.data.notified ? "Saved. Students were told what changed." : "Saved") : `Event posted. ${j.data.reach} student${j.data.reach === 1 ? "" : "s"} notified.`);
        setEditing(null);
        reload();
    };

    const cancel = async () => {
        if (!cancelling) return;
        setBusy(true);
        const j = await fetch(`${base}/${cancelling._id}/cancel`, { method: "POST", credentials: "include" }).then((r) => r.json()).catch(() => ({ success: false, error: "Failed" }));
        setBusy(false);
        setCancelling(null);
        if (!j.success) return toast.error(j.error);
        toast.success("Event cancelled. Students were told.");
        reload();
    };

    const [now] = useState(() => Date.now());
    const when = (e: EventRow) => new Date(e.startsAt ?? e.deadlineAt ?? 0).getTime();
    const upcoming = (items ?? []).filter((e) => e.status !== "cancelled" && (when(e) === 0 || when(e) >= now)).sort((a, b) => when(a) - when(b));
    const past = (items ?? []).filter((e) => !upcoming.includes(e));

    const card = (e: EventRow) => (
        <li key={e._id} className={`plasma-card p-4 ${e.status === "cancelled" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className={`font-semibold text-[var(--text)] ${e.status === "cancelled" ? "line-through" : ""}`}>{e.title}</p>
                    <p className="text-xs text-[var(--text-2)]">{fmt(e.startsAt) ?? (e.deadlineAt ? `Due ${fmt(e.deadlineAt)}` : "No date")}{e.venue ? ` · ${e.venue}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{TYPE_LABEL[e.type] ?? e.type}</Badge>
                    <Badge variant="secondary">{audienceLabel(e.audience)}</Badge>
                    {e.status === "cancelled" && <Badge variant="danger">Cancelled</Badge>}
                </div>
            </div>
            {canEdit && e.status !== "cancelled" && (
                <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => open(e)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelling(e)}>Cancel event</Button>
                </div>
            )}
        </li>
    );

    return (
        <div className="max-w-4xl space-y-5">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-bold text-[var(--heading)]">{internshipId ? "Events" : "Campus events"}</h1>
                {canEdit && <Button size="sm" className="gap-1.5" onClick={() => open()}><CalendarPlus className="h-4 w-4" /> New event</Button>}
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : !items ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : items.length === 0 ? (
                <div className="plasma-card p-10 text-center"><Megaphone className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" /><p className="text-sm text-[var(--text-2)]">No events yet. Post instructions, test links and interview schedules here; students are notified.</p></div>
            ) : (
                <>
                    {upcoming.length > 0 && <section className="space-y-2"><h2 className="label">Upcoming</h2><ul className="space-y-2">{upcoming.map(card)}</ul></section>}
                    {past.length > 0 && <section className="space-y-2"><h2 className="label">Past and cancelled</h2><ul className="space-y-2">{past.map(card)}</ul></section>}
                </>
            )}

            <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit event" : "New event"} size="lg">
                {f && (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Type"><select className={controlCls} value={f.type} onChange={(e) => set({ type: e.target.value })}>{CAMPUS_EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></Field>
                            <Input label="Title" value={f.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
                        </div>
                        <Field label="Details"><textarea className={controlCls} rows={4} maxLength={10000} value={f.body} onChange={(e) => set({ body: e.target.value })} /></Field>
                        {!internshipId && !editing?.id && (
                            <Field label="About" hint="Leave on 'Whole campus' for general notices.">
                                <select className={controlCls} value={f.internshipId} onChange={(e) => set({ internshipId: e.target.value, audienceKind: "all_members" })}>
                                    <option value="">Whole campus</option>
                                    {internships.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                                </select>
                            </Field>
                        )}
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Input label="Starts" type="datetime-local" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
                            <Input label="Ends" type="datetime-local" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
                            <Input label="Deadline" type="datetime-local" value={f.deadlineAt} onChange={(e) => set({ deadlineAt: e.target.value })} hint="For forms and submissions" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Mode"><select className={controlCls} value={f.mode} onChange={(e) => set({ mode: e.target.value })}>{CAMPUS_EVENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
                            <Input label="Venue" value={f.venue} maxLength={300} onChange={(e) => set({ venue: e.target.value })} />
                            <Input label="Link" value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Who is it for?">
                                <select className={controlCls} value={f.audienceKind} onChange={(e) => set({ audienceKind: e.target.value, audienceValue: "" })}>
                                    <option value="all_members">All students of the campus</option>
                                    <option value="batch">A graduation batch</option>
                                    {(f.internshipId || internshipId) && <><option value="eligible">Students eligible for the internship</option><option value="applicants">Applicants</option><option value="shortlisted">Shortlisted</option><option value="round">A selection round</option></>}
                                </select>
                            </Field>
                            {f.audienceKind === "batch" && <Input label="Batch year" type="number" value={f.audienceValue} onChange={(e) => set({ audienceValue: e.target.value })} placeholder="e.g. 2027" />}
                            {f.audienceKind === "round" && (rounds.length ? <Field label="Round"><select className={controlCls} value={f.audienceValue} onChange={(e) => set({ audienceValue: e.target.value })}><option value="">Select…</option>{rounds.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field> : <Input label="Round name" value={f.audienceValue} onChange={(e) => set({ audienceValue: e.target.value })} />)}
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm">
                            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--campus)]" checked={f.email} onChange={(e) => set({ email: e.target.checked })} /> Email students</label>
                            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[var(--campus)]" checked={f.sms} onChange={(e) => set({ sms: e.target.checked })} /> SMS (only students who opted in)</label>
                        </div>
                        <p className="text-xs text-[var(--text-3)]">Students always get an in-app notice. Changing the time, venue, link or mode later tells them what changed.</p>
                        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} disabled={f.title.trim().length < 3 || (f.audienceKind === "batch" && !f.audienceValue) || (f.audienceKind === "round" && !f.audienceValue)} onClick={save}>{editing?.id ? "Save" : "Post event"}</Button></div>
                    </div>
                )}
            </Modal>
            <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel "${cancelling?.title ?? ""}"?`} size="sm">
                <p className="mb-4 text-sm text-[var(--text-2)]">The students it was sent to are told it is cancelled. It stays on the list, marked cancelled.</p>
                <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCancelling(null)}>Keep it</Button><Button variant="danger" loading={busy} onClick={cancel}>Cancel event</Button></div>
            </Modal>
        </div>
    );
}
