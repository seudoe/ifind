"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field, ImageField, controlCls } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { CAMPUS_COMPANY_TIERS, CAMPUS_ROUND_TYPES, CAMPUS_WORK_MODES, type CampusInternshipDTO } from "@/types/campus";
import { QUESTION_TYPES, type QuestionType } from "@/types/employer";

interface Round { name: string; type: (typeof CAMPUS_ROUND_TYPES)[number]; plannedDate: string; notes: string }
interface Question { _id?: string; question: string; type: QuestionType; options: string[]; required: boolean }

interface FormState {
    companyName: string; tier: string; website: string; industry: string; logo: string;
    designation: string; description: string; workMode: (typeof CAMPUS_WORK_MODES)[number]; locations: string[]; openings: string; ppoAvailable: boolean;
    skills: string[]; responsibilities: string; perks: string[];
    deadlineDate: string; assessmentDate: string; interviewDate: string; resultDate: string; startDate: string;
    rounds: Round[];
    durationValue: string; durationUnit: "weeks" | "months";
    stipendType: "" | "paid" | "unpaid" | "performance-based"; stipendAmount: string; stipendPeriod: "monthly" | "weekly" | "lump-sum";
    batches: string[]; courses: string[]; departments: string[]; minCgpa: string; maxBacklogs: string; otherElig: string;
    requireResume: boolean; maxApplications: string; questions: Question[];
}

const EMPTY: FormState = {
    companyName: "", tier: "", website: "", industry: "", logo: "",
    designation: "", description: "", workMode: "onsite", locations: [], openings: "", ppoAvailable: false,
    skills: [], responsibilities: "", perks: [],
    deadlineDate: "", assessmentDate: "", interviewDate: "", resultDate: "", startDate: "",
    rounds: [], durationValue: "", durationUnit: "months", stipendType: "", stipendAmount: "", stipendPeriod: "monthly",
    batches: [], courses: [], departments: [], minCgpa: "", maxBacklogs: "", otherElig: "",
    requireResume: true, maxApplications: "", questions: [],
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const pad = (n: number) => String(n).padStart(2, "0");
/** ISO -> value for <input type="datetime-local"> in the browser's zone. */
const toLocal = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** datetime-local value -> ISO (empty stays empty). */
const toIso = (v: string) => (v ? new Date(v).toISOString() : "");

function fromDTO(d: CampusInternshipDTO): FormState {
    return {
        companyName: d.company.name, tier: str(d.company.tier), website: str(d.company.website), industry: str(d.company.industry), logo: str(d.company.logo),
        designation: d.designation, description: d.description ?? "", workMode: d.workMode, locations: d.locations ?? [], openings: str(d.openings), ppoAvailable: d.ppoAvailable,
        skills: d.skills ?? [], responsibilities: (d.responsibilities ?? []).join("\n"), perks: d.perks ?? [],
        deadlineDate: toLocal(d.deadlineDate), assessmentDate: toLocal(d.assessmentDate), interviewDate: toLocal(d.interviewDate), resultDate: toLocal(d.resultDate), startDate: toLocal(d.startDate),
        rounds: (d.rounds ?? []).map((r) => ({ name: r.name, type: r.type, plannedDate: toLocal(r.plannedDate), notes: str(r.notes) })),
        durationValue: str(d.duration?.value), durationUnit: d.duration?.unit ?? "months",
        stipendType: d.stipend?.type ?? "", stipendAmount: str(d.stipend?.amount), stipendPeriod: d.stipend?.period ?? "monthly",
        batches: (d.eligibility?.batches ?? []).map(String), courses: d.eligibility?.courses ?? [], departments: d.eligibility?.departments ?? [],
        minCgpa: str(d.eligibility?.minCgpa), maxBacklogs: str(d.eligibility?.maxBacklogs), otherElig: str(d.eligibility?.other),
        requireResume: d.requireResume, maxApplications: str(d.maxApplications),
        questions: (d.screeningQuestions ?? []).map((q) => ({ _id: q._id, question: q.question, type: q.type, options: q.options, required: q.required })),
    };
}

/** The form always sends every field; the API treats it as a full replace. */
function toPayload(s: FormState, sourceText?: string | null) {
    return {
        company: { name: s.companyName.trim(), tier: s.tier, website: s.website, industry: s.industry, logo: s.logo },
        designation: s.designation.trim(), description: s.description, sourceText: sourceText ?? undefined,
        workMode: s.workMode, locations: s.locations, openings: s.openings, ppoAvailable: s.ppoAvailable,
        skills: s.skills, responsibilities: s.responsibilities.split("\n").map((l) => l.trim()).filter(Boolean), perks: s.perks,
        deadlineDate: toIso(s.deadlineDate), assessmentDate: toIso(s.assessmentDate), interviewDate: toIso(s.interviewDate), resultDate: toIso(s.resultDate), startDate: toIso(s.startDate),
        rounds: s.rounds.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), type: r.type, plannedDate: toIso(r.plannedDate), notes: r.notes })),
        duration: s.durationValue ? { value: s.durationValue, unit: s.durationUnit } : null,
        stipend: s.stipendType ? { type: s.stipendType, amount: s.stipendAmount, period: s.stipendPeriod } : null,
        eligibility: { batches: s.batches.map(Number).filter((n) => Number.isInteger(n)), courses: s.courses, departments: s.departments, minCgpa: s.minCgpa, maxBacklogs: s.maxBacklogs, other: s.otherElig },
        requireResume: s.requireResume, maxApplications: s.maxApplications,
        screeningQuestions: s.questions.filter((q) => q.question.trim()),
    };
}

const QUESTION_LABEL: Record<QuestionType, string> = { text: "Short text", yes_no: "Yes / No", single_choice: "Single choice", multi_choice: "Multiple choice", number: "Number" };
const TIER_LABEL: Record<string, string> = { dream: "Dream", super_dream: "Super dream", normal: "Normal" };
const ROUND_LABEL: Record<string, string> = { online_assessment: "Online assessment", group_discussion: "Group discussion", technical: "Technical interview", hr: "HR interview", other: "Other" };

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--campus)]" />
            {label}
        </label>
    );
}

const TBA = "To be announced";

interface Props {
    entityId: string;
    initial?: CampusInternshipDTO;
    title?: string;
    /** Viewers see the details but cannot change them. */
    canEdit?: boolean;
    /** Suggestions from the campus settings. */
    suggestions: { courses: string[]; departments: string[]; batches: string[] };
}

export function CampusInternshipForm({ entityId, initial, title, suggestions, canEdit = true }: Props) {
    const router = useRouter();
    const base = `/api/employer/campus/${entityId}/internships`;
    const [data, setData] = useState<FormState>(initial ? fromDTO(initial) : EMPTY);
    const status = initial?.status ?? "draft";
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);

    const dirty = useRef(false);
    const busy = useRef(false);
    const idRef = useRef<string | null>(initial?._id ?? null);
    const dataRef = useRef(data);
    useEffect(() => { dataRef.current = data; }, [data]);

    const isDraft = status === "draft";
    const readOnly = !canEdit || !["draft", "open"].includes(status);

    const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
        dirty.current = true;
        setData((d) => ({ ...d, [k]: v }));
    };

    /** Create (first time) or update. Serialised via `busy` so a slow create can't race a second one. */
    const save = useCallback(async (): Promise<CampusInternshipDTO | null> => {
        const body = toPayload(dataRef.current, initial?.sourceText);
        if (body.company.name.length < 2 || body.designation.length < 2) {
            setError("Add the company and the designation to save");
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
            return j.data as CampusInternshipDTO;
        } catch (err) {
            dirty.current = true;
            setSaveState("error");
            setError(err instanceof Error ? err.message : "Unable to save");
            return null;
        } finally {
            busy.current = false;
        }
    }, [base, initial?.sourceText]);

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
                toast.success("Published. Joined students of this campus can see it now.");
                router.push(`/employer/campus/${entityId}/internships/${saved._id}/details`);
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

    const fixed = !!title;
    const q = data.questions;
    const setQ = (i: number, patch: Partial<Question>) => set("questions", q.map((x, n) => (n === i ? { ...x, ...patch } : x)));
    const setRound = (i: number, patch: Partial<Round>) => set("rounds", data.rounds.map((x, n) => (n === i ? { ...x, ...patch } : x)));

    return (
        <div className={fixed ? "flex flex-col gap-3 h-[calc(100dvh-5rem)] md:h-[calc(100dvh-4rem)] max-w-3xl" : "max-w-3xl space-y-5"}>
            {(title || error) && (
                <div className={fixed ? "shrink-0 space-y-2" : "sticky top-12 md:top-0 z-20 -mx-1 space-y-2 bg-[var(--bg)] px-1 pb-2 pt-1"}>
                    {title && <h1 className="text-lg font-bold text-[var(--heading)]">{title}</h1>}
                    {error && <div role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
                </div>
            )}
            <div className={fixed ? "flex-1 min-h-0 overflow-y-auto space-y-5 pr-2" : "space-y-5"}>
                {readOnly && <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-2)]">{canEdit ? `This internship is ${status} and read-only. Duplicate it from Settings to post it again.` : "You have view-only access."}</div>}

                <fieldset disabled={readOnly || publishing} className="space-y-5 min-w-0">
                    <section className="plasma-card p-5 space-y-4 border-l-4 border-l-[var(--campus)]">
                        <h2 className="font-semibold text-[var(--heading)]">Company</h2>
                        <Input label="Company name" value={data.companyName} onChange={(e) => set("companyName", e.target.value)} maxLength={150} placeholder="e.g. Acme Technologies" hint="Required. This is what students look for first." />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Tier (optional)">
                                <select className={controlCls} value={data.tier} onChange={(e) => set("tier", e.target.value)}>
                                    <option value="">Not set</option>
                                    {CAMPUS_COMPANY_TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                                </select>
                            </Field>
                            <Input label="Industry (optional)" value={data.industry} onChange={(e) => set("industry", e.target.value)} maxLength={80} />
                        </div>
                        <Input label="Website (optional)" value={data.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
                        <ImageField label="Company logo (optional)" value={data.logo} onChange={(u) => set("logo", u)} />
                    </section>

                    <section className="plasma-card p-5 space-y-4">
                        <h2 className="font-semibold text-[var(--heading)]">Role</h2>
                        <Input label="Designation" value={data.designation} onChange={(e) => set("designation", e.target.value)} maxLength={150} placeholder="e.g. Software Engineer Intern" />
                        <Field label="Description" hint="Plain text. Paste the company's notification if you have it.">
                            <textarea rows={6} maxLength={10000} className={controlCls} value={data.description} onChange={(e) => set("description", e.target.value)} />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Work mode">
                                <select className={controlCls} value={data.workMode} onChange={(e) => set("workMode", e.target.value as FormState["workMode"])}>
                                    {CAMPUS_WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </Field>
                            <Input label="Openings" type="number" min={1} value={data.openings} onChange={(e) => set("openings", e.target.value)} />
                            <div className="flex items-end pb-2"><Check label="PPO possible" checked={data.ppoAvailable} onChange={(v) => set("ppoAvailable", v)} /></div>
                        </div>
                        <TagInput label="Locations" tags={data.locations} onChange={(v) => set("locations", v)} placeholder="e.g. Mumbai, Remote" />
                        <TagInput label="Skills" tags={data.skills} onChange={(v) => set("skills", v)} placeholder="e.g. React, SQL" />
                        <Field label="Responsibilities" hint="One per line">
                            <textarea rows={3} className={controlCls} value={data.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} />
                        </Field>
                        <TagInput label="Perks" tags={data.perks} onChange={(v) => set("perks", v)} placeholder="e.g. Certificate" />
                    </section>

                    <section className="plasma-card p-5 space-y-4">
                        <h2 className="font-semibold text-[var(--heading)]">Dates</h2>
                        <p className="text-xs text-[var(--text-3)]">Only the application deadline is needed to publish. Leave the rest empty; students see &ldquo;{TBA}&rdquo;. Add them later and post an event.</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Application deadline" type="datetime-local" value={data.deadlineDate} onChange={(e) => set("deadlineDate", e.target.value)} hint="Required to publish. Closes automatically at this time." />
                            <Input label="Online assessment" type="datetime-local" value={data.assessmentDate} onChange={(e) => set("assessmentDate", e.target.value)} hint={TBA} />
                            <Input label="Interviews" type="datetime-local" value={data.interviewDate} onChange={(e) => set("interviewDate", e.target.value)} hint={TBA} />
                            <Input label="Results" type="datetime-local" value={data.resultDate} onChange={(e) => set("resultDate", e.target.value)} hint={TBA} />
                            <Input label="Internship start" type="datetime-local" value={data.startDate} onChange={(e) => set("startDate", e.target.value)} hint={TBA} />
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-[var(--text-2)] font-mono uppercase tracking-[0.07em]">Selection rounds ({data.rounds.length}/10)</p>
                            {data.rounds.map((r, i) => (
                                <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end">
                                    <Input aria-label={`Round ${i + 1} name`} placeholder="Round name" value={r.name} maxLength={80} onChange={(e) => setRound(i, { name: e.target.value })} />
                                    <select className={`${controlCls} !w-auto`} value={r.type} aria-label="Round type" onChange={(e) => setRound(i, { type: e.target.value as Round["type"] })}>
                                        {CAMPUS_ROUND_TYPES.map((t) => <option key={t} value={t}>{ROUND_LABEL[t]}</option>)}
                                    </select>
                                    <Input aria-label="Planned date" type="datetime-local" value={r.plannedDate} onChange={(e) => setRound(i, { plannedDate: e.target.value })} />
                                    <button type="button" aria-label="Remove round" onClick={() => set("rounds", data.rounds.filter((_, n) => n !== i))} className="p-2 text-[var(--text-3)] hover:text-[var(--danger)]"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            ))}
                            {data.rounds.length < 10 && (
                                <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => set("rounds", [...data.rounds, { name: "", type: "other", plannedDate: "", notes: "" }])}><Plus className="h-4 w-4" /> Add round</Button>
                            )}
                        </div>
                    </section>

                    <section className="plasma-card p-5 space-y-4">
                        <h2 className="font-semibold text-[var(--heading)]">Compensation and duration</h2>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Stipend">
                                <select className={controlCls} value={data.stipendType} onChange={(e) => set("stipendType", e.target.value as FormState["stipendType"])}>
                                    <option value="">{TBA}</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="performance-based">Performance based</option>
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
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Duration" type="number" min={1} max={60} value={data.durationValue} onChange={(e) => set("durationValue", e.target.value)} hint={data.durationValue ? undefined : TBA} />
                            <Field label="Unit">
                                <select className={controlCls} value={data.durationUnit} onChange={(e) => set("durationUnit", e.target.value as "weeks" | "months")}>
                                    <option value="months">months</option><option value="weeks">weeks</option>
                                </select>
                            </Field>
                        </div>
                    </section>

                    <section className="plasma-card p-5 space-y-4">
                        <h2 className="font-semibold text-[var(--heading)]">Eligibility</h2>
                        <p className="text-xs text-[var(--text-3)]">Empty means open to everyone. Students who don&apos;t match see the exact reason and can&apos;t apply.</p>
                        <TagInput label="Graduation batches" tags={data.batches} onChange={(v) => set("batches", v)} suggestions={suggestions.batches} placeholder="e.g. 2027" />
                        <TagInput label="Courses" tags={data.courses} onChange={(v) => set("courses", v)} suggestions={suggestions.courses} placeholder="e.g. B.Tech" />
                        <TagInput label="Departments" tags={data.departments} onChange={(v) => set("departments", v)} suggestions={suggestions.departments} placeholder="e.g. Computer Engineering" />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Minimum CGPA" type="number" min={0} max={100} step="0.01" value={data.minCgpa} onChange={(e) => set("minCgpa", e.target.value)} />
                            <Input label="Max active backlogs" type="number" min={0} value={data.maxBacklogs} onChange={(e) => set("maxBacklogs", e.target.value)} />
                        </div>
                        <Field label="Other conditions (optional)">
                            <textarea rows={2} maxLength={1000} className={controlCls} value={data.otherElig} onChange={(e) => set("otherElig", e.target.value)} />
                        </Field>
                    </section>

                    <section className="plasma-card p-5 space-y-4">
                        <h2 className="font-semibold text-[var(--heading)]">Application settings</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input label="Max applications" type="number" min={1} value={data.maxApplications} onChange={(e) => set("maxApplications", e.target.value)} hint="Closes automatically when reached" />
                            <div className="flex items-end pb-2"><Check label="Resume required" checked={data.requireResume} onChange={(v) => set("requireResume", v)} /></div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-[var(--text-2)] font-mono uppercase tracking-[0.07em]">Screening questions ({q.length}/10)</p>
                            {q.map((item, i) => (
                                <div key={item._id ?? i} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 space-y-3">
                                    <div className="flex gap-2">
                                        <input className={controlCls} placeholder="Question" maxLength={300} value={item.question} onChange={(e) => setQ(i, { question: e.target.value })} aria-label={`Question ${i + 1}`} />
                                        <button type="button" aria-label="Remove question" title="Remove" onClick={() => set("questions", q.filter((_, n) => n !== i))} className="p-2 text-[var(--text-3)] hover:text-[var(--danger)]"><Trash2 className="h-4 w-4" /></button>
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
                                <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => set("questions", [...q, { question: "", type: "text", options: [], required: false }])}><Plus className="h-4 w-4" /> Add question</Button>
                            )}
                        </div>
                    </section>
                </fieldset>
            </div>

            {!readOnly && (
                <div className={(fixed ? "shrink-0" : "sticky bottom-0 -mx-1 px-1") + " flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg)] py-3"}>
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
