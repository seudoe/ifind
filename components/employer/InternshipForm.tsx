"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field, controlCls } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { QUESTION_TYPES, WORK_MODES, type PlatformInternship, type QuestionType, type WorkMode } from "@/types/employer";

interface Question { _id?: string; question: string; type: QuestionType; options: string[]; required: boolean }

interface FormState {
    name: string; workMode: WorkMode; country: string; state: string; city: string; openings: string;
    startDate: string; durationValue: string; durationUnit: "weeks" | "months"; hoursPerWeek: string;
    stipendType: "" | "paid" | "unpaid" | "performance-based"; stipendAmount: string; stipendPeriod: "monthly" | "weekly" | "lump-sum";
    skills: string[]; degree: string[]; field: string[]; expMin: string; expMax: string;
    summary: string; responsibilities: string; perks: string[]; whoCanApply: string; ppoAvailable: boolean; certificate: boolean;
    deadlineDate: string; requireResume: boolean; requireCoverLetter: boolean; maxApplications: string; questions: Question[];
}

const EMPTY: FormState = {
    name: "", workMode: "onsite", country: "India", state: "", city: "", openings: "", startDate: "",
    durationValue: "", durationUnit: "months", hoursPerWeek: "", stipendType: "", stipendAmount: "", stipendPeriod: "monthly",
    skills: [], degree: [], field: [], expMin: "", expMax: "", summary: "", responsibilities: "", perks: [], whoCanApply: "",
    ppoAvailable: false, certificate: false, deadlineDate: "", requireResume: true, requireCoverLetter: false, maxApplications: "", questions: [],
};

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function fromDTO(d: PlatformInternship): FormState {
    return {
        name: d.name, workMode: d.workMode, country: str(d.country), state: str(d.state), city: str(d.city), openings: str(d.openings),
        startDate: day(d.startDate), durationValue: str(d.duration?.value), durationUnit: d.duration?.unit ?? "months", hoursPerWeek: str(d.hoursPerWeek),
        stipendType: d.stipend?.type ?? "", stipendAmount: str(d.stipend?.amount), stipendPeriod: d.stipend?.period ?? "monthly",
        skills: d.skills ?? [], degree: d.degree ?? [], field: d.field ?? [],
        expMin: str(d.experienceRequired?.min), expMax: str(d.experienceRequired?.max),
        summary: d.summary ?? "", responsibilities: (d.responsibilities ?? []).join("\n"), perks: d.perks ?? [], whoCanApply: str(d.whoCanApply),
        ppoAvailable: d.ppoAvailable, certificate: d.certificate, deadlineDate: day(d.deadlineDate),
        requireResume: d.requireResume, requireCoverLetter: d.requireCoverLetter, maxApplications: str(d.maxApplications),
        questions: (d.screeningQuestions ?? []).map((q) => ({ _id: q._id, question: q.question, type: q.type, options: q.options, required: q.required })),
    };
}

/** The form always sends every field; the API treats it as a full replace. */
function toPayload(s: FormState) {
    return {
        name: s.name.trim(), workMode: s.workMode, country: s.country, state: s.state, city: s.city, openings: s.openings,
        startDate: s.startDate, hoursPerWeek: s.hoursPerWeek,
        duration: s.durationValue ? { value: s.durationValue, unit: s.durationUnit } : undefined,
        stipend: s.stipendType ? { type: s.stipendType, amount: s.stipendAmount, period: s.stipendPeriod } : undefined,
        skills: s.skills, degree: s.degree, field: s.field,
        experienceRequired: s.expMin || s.expMax ? { min: s.expMin, max: s.expMax, unit: "years" } : null,
        summary: s.summary, responsibilities: s.responsibilities.split("\n").map((l) => l.trim()).filter(Boolean),
        perks: s.perks, whoCanApply: s.whoCanApply, ppoAvailable: s.ppoAvailable, certificate: s.certificate,
        deadlineDate: s.deadlineDate, requireResume: s.requireResume, requireCoverLetter: s.requireCoverLetter, maxApplications: s.maxApplications,
        screeningQuestions: s.questions.filter((q) => q.question.trim()),
    };
}

const QUESTION_LABEL: Record<QuestionType, string> = { text: "Short text", yes_no: "Yes / No", single_choice: "Single choice", multi_choice: "Multiple choice", number: "Number" };

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            {label}
        </label>
    );
}

interface Props {
    companyId: string;
    /** Existing internship (edit); omit for a new one. */
    initial?: PlatformInternship;
}

export function InternshipForm({ companyId, initial }: Props) {
    const router = useRouter();
    const base = `/api/employer/companies/${companyId}/internships`;
    const [data, setData] = useState<FormState>(initial ? fromDTO(initial) : EMPTY);
    const status = initial?.status ?? "draft";
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);

    const dirty = useRef(false);
    const busy = useRef(false);
    const idRef = useRef<string | null>(initial?._id ?? null);
    const dataRef = useRef(data);
    dataRef.current = data;

    const isDraft = status === "draft";
    const readOnly = !["draft", "published", "paused"].includes(status);

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
        dirty.current = true;
        setData((d) => ({ ...d, [k]: v }));
    };

    /** Create (first time) or update. Serialised via `busy` so a slow create can't race a second one. */
    const save = useCallback(async (): Promise<PlatformInternship | null> => {
        const body = toPayload(dataRef.current);
        if (body.name.length < 3) {
            setError("Add a title (min 3 characters) to save");
            return null;
        }
        busy.current = true;
        dirty.current = false;
        setSaveState("saving");
        try {
            const res = await fetch(idRef.current ? `${base}/${idRef.current}` : base, {
                method: idRef.current ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            const j = await res.json();
            if (!j.success) throw new Error(j.error);
            idRef.current = j.data._id;
            setSaveState("saved");
            setError(null);
            if (j.sentBackToModeration) toast.info("You changed key details, so this listing is back in moderator review");
            return j.data as PlatformInternship;
        } catch (err) {
            dirty.current = true;
            setSaveState("error");
            setError(err instanceof Error ? err.message : "Unable to save");
            return null;
        } finally {
            busy.current = false;
        }
    }, [base]);

    // Autosave drafts 1.5 s after the last edit
    useEffect(() => {
        if (!isDraft || !dirty.current) return;
        const t = setTimeout(function tick() {
            if (busy.current) return void setTimeout(tick, 800);
            if (dirty.current) void save();
        }, 1500);
        return () => clearTimeout(t);
    }, [data, isDraft, save]);

    const publish = async () => {
        setPublishing(true);
        const saved = await save();
        if (saved) {
            const res = await fetch(`${base}/${saved._id}/publish`, { method: "POST", credentials: "include" });
            const j = await res.json();
            if (j.success) {
                toast.success("Published. A moderator will review it before students see it.");
                router.push(`/employer/company/${companyId}/internships/${saved._id}/overview`);
                router.refresh();
                return;
            }
            setError(j.error);
        }
        setPublishing(false);
    };

    const saveEdit = async () => {
        if (await save()) {
            toast.success("Changes saved");
            router.refresh();
        }
    };

    const q = data.questions;
    const setQ = (i: number, patch: Partial<Question>) => set("questions", q.map((x, n) => (n === i ? { ...x, ...patch } : x)));

    return (
        <div className="max-w-3xl space-y-5">
            {error && <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            {readOnly && <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-2)]">This internship is {status} and read-only. Duplicate it from Settings to post it again.</div>}

            <fieldset disabled={readOnly || publishing} className="space-y-5 min-w-0">
                <section className="plasma-card p-5 space-y-4">
                    <h2 className="font-semibold text-[var(--text)]">Basics</h2>
                    <Input label="Title" value={data.name} onChange={(e) => set("name", e.target.value)} maxLength={150} placeholder="e.g. Backend Developer Intern" />
                    <Field label="Work mode">
                        <select className={controlCls} value={data.workMode} onChange={(e) => set("workMode", e.target.value as WorkMode)}>
                            {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="City" value={data.city} onChange={(e) => set("city", e.target.value)} />
                        <Input label="State" value={data.state} onChange={(e) => set("state", e.target.value)} />
                        <Input label="Country" value={data.country} onChange={(e) => set("country", e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="Openings" type="number" min={1} value={data.openings} onChange={(e) => set("openings", e.target.value)} />
                        <Input label="Start date" type="date" value={data.startDate} onChange={(e) => set("startDate", e.target.value)} hint="Empty = immediate" />
                        <Input label="Hours / week" type="number" min={1} max={80} value={data.hoursPerWeek} onChange={(e) => set("hoursPerWeek", e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Duration" type="number" min={1} max={60} value={data.durationValue} onChange={(e) => set("durationValue", e.target.value)} />
                        <Field label="Unit">
                            <select className={controlCls} value={data.durationUnit} onChange={(e) => set("durationUnit", e.target.value as "weeks" | "months")}>
                                <option value="months">months</option><option value="weeks">weeks</option>
                            </select>
                        </Field>
                    </div>
                </section>

                <section className="plasma-card p-5 space-y-4">
                    <h2 className="font-semibold text-[var(--text)]">Stipend</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Type">
                            <select className={controlCls} value={data.stipendType} onChange={(e) => set("stipendType", e.target.value as FormState["stipendType"])}>
                                <option value="">Select…</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="performance-based">Performance based</option>
                            </select>
                        </Field>
                        {data.stipendType === "paid" && (
                            <>
                                <Input label="Amount (INR)" type="number" min={0} value={data.stipendAmount} onChange={(e) => set("stipendAmount", e.target.value)} />
                                <Field label="Per">
                                    <select className={controlCls} value={data.stipendPeriod} onChange={(e) => set("stipendPeriod", e.target.value as FormState["stipendPeriod"])}>
                                        <option value="monthly">month</option><option value="weekly">week</option><option value="lump-sum">lump sum</option>
                                    </select>
                                </Field>
                            </>
                        )}
                    </div>
                </section>

                <section className="plasma-card p-5 space-y-4">
                    <h2 className="font-semibold text-[var(--text)]">Requirements</h2>
                    <TagInput label="Skills" tags={data.skills} onChange={(v) => set("skills", v)} placeholder="e.g. React, SQL" />
                    <TagInput label="Degrees (optional)" tags={data.degree} onChange={(v) => set("degree", v)} placeholder="e.g. B.Tech" />
                    <TagInput label="Fields of study (optional)" tags={data.field} onChange={(v) => set("field", v)} placeholder="e.g. Computer Science" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Experience min (years)" type="number" min={0} value={data.expMin} onChange={(e) => set("expMin", e.target.value)} />
                        <Input label="Experience max (years)" type="number" min={0} value={data.expMax} onChange={(e) => set("expMax", e.target.value)} />
                    </div>
                </section>

                <section className="plasma-card p-5 space-y-4">
                    <h2 className="font-semibold text-[var(--text)]">Description</h2>
                    <Field label="Summary" hint="Plain text. What will the intern do and learn? (min 30 characters to publish)">
                        <textarea rows={6} maxLength={5000} className={controlCls} value={data.summary} onChange={(e) => set("summary", e.target.value)} />
                    </Field>
                    <Field label="Responsibilities" hint="One per line">
                        <textarea rows={4} className={controlCls} value={data.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} />
                    </Field>
                    <TagInput label="Perks" tags={data.perks} onChange={(v) => set("perks", v)} placeholder="e.g. Certificate, Free lunch" />
                    <Field label="Who can apply (optional)">
                        <textarea rows={3} maxLength={1000} className={controlCls} value={data.whoCanApply} onChange={(e) => set("whoCanApply", e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap gap-6">
                        <Check label="Pre-placement offer possible" checked={data.ppoAvailable} onChange={(v) => set("ppoAvailable", v)} />
                        <Check label="Certificate provided" checked={data.certificate} onChange={(v) => set("certificate", v)} />
                    </div>
                </section>

                <section className="plasma-card p-5 space-y-4">
                    <h2 className="font-semibold text-[var(--text)]">Application settings</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Deadline" type="date" value={data.deadlineDate} onChange={(e) => set("deadlineDate", e.target.value)} hint="Closes automatically after this day" />
                        <Input label="Max applications" type="number" min={1} value={data.maxApplications} onChange={(e) => set("maxApplications", e.target.value)} hint="Closes automatically when reached" />
                    </div>
                    <div className="flex flex-wrap gap-6">
                        <Check label="Resume required" checked={data.requireResume} onChange={(v) => set("requireResume", v)} />
                        <Check label="Cover letter required" checked={data.requireCoverLetter} onChange={(v) => set("requireCoverLetter", v)} />
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs font-medium text-[var(--text-2)] uppercase tracking-wide">Screening questions ({q.length}/10)</p>
                        {q.map((item, i) => (
                            <div key={item._id ?? i} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 space-y-3">
                                <div className="flex gap-2">
                                    <input className={controlCls} placeholder="Question" maxLength={300} value={item.question} onChange={(e) => setQ(i, { question: e.target.value })} aria-label={`Question ${i + 1}`} />
                                    <button type="button" aria-label="Remove question" title="Remove" onClick={() => set("questions", q.filter((_, n) => n !== i))} className="p-2 text-[var(--text-3)] hover:text-[var(--danger)]">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <select className={`${controlCls} !w-auto`} value={item.type} onChange={(e) => setQ(i, { type: e.target.value as QuestionType })} aria-label="Answer type">
                                        {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_LABEL[t]}</option>)}
                                    </select>
                                    <Check label="Required" checked={item.required} onChange={(v) => setQ(i, { required: v })} />
                                </div>
                                {(item.type === "single_choice" || item.type === "multi_choice") && (
                                    <TagInput label="Options" tags={item.options} onChange={(v) => setQ(i, { options: v })} placeholder="Add an option and press Enter" />
                                )}
                            </div>
                        ))}
                        {q.length < 10 && (
                            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => set("questions", [...q, { question: "", type: "text", options: [], required: false }])}>
                                <Plus className="h-4 w-4" /> Add question
                            </Button>
                        )}
                    </div>
                </section>
            </fieldset>

            {!readOnly && (
                <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg)] px-1 py-3">
                    <span className="text-xs text-[var(--text-3)]" aria-live="polite">
                        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved" : saveState === "error" ? "Not saved" : isDraft ? "Draft: autosaves as you type" : ""}
                    </span>
                    <div className="flex gap-2">
                        {isDraft ? (
                            <>
                                <Button type="button" variant="secondary" onClick={() => void save()} disabled={publishing}>Save draft</Button>
                                <Button type="button" onClick={publish} loading={publishing}>Publish</Button>
                            </>
                        ) : (
                            <Button type="button" onClick={saveEdit}>Save changes</Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
