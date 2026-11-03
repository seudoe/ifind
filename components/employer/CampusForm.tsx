"use client";

import { useEffect, useState } from "react";
import { Plus, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { CollegePicker, type PickedCollege } from "@/components/employer/CollegePicker";
import { controlCls, Field, ImageField } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import type { CampusProfileInput } from "@/lib/campus/validation";

export type CampusFormData = Omit<CampusProfileInput, "batches" | "policy"> & {
    batches: number[];
    policy: { oneStudentOneOffer: boolean; acceptWindowHours?: number | string };
};

export const EMPTY_CAMPUS: CampusFormData = {
    name: "", description: "", listing: "listed", courses: [], batches: [], uidLabel: "College ID",
    policy: { oneStudentOneOffer: false },
};

interface Others { _id: string; name: string; createdAt: string; members: number; reportCount: number }

interface Props {
    mode: "create" | "edit";
    initial?: Partial<CampusFormData>;
    /** Resolves to an error message, or null on success. `collegeId` is set only in create mode. */
    onSubmit: (data: CampusFormData, collegeId?: string) => Promise<string | null>;
}

export function CampusForm({ mode, initial, onSubmit }: Props) {
    const create = mode === "create";
    const [d, setD] = useState<CampusFormData>({ ...EMPTY_CAMPUS, ...initial });
    const [college, setCollege] = useState<PickedCollege | null>(null);
    const [found, setFound] = useState<{ id: string; rows: Others[] } | null>(null);
    const [busy, setBusy] = useState(false);
    const others = college && found?.id === college._id ? found.rows : [];
    const set = <K extends keyof CampusFormData>(k: K, v: CampusFormData[K]) => setD((s) => ({ ...s, [k]: v }));

    // Warn (never block) when other campuses of this college already exist
    useEffect(() => {
        if (!create || !college) return;
        let live = true;
        const id = college._id;
        fetch(`/api/employer/colleges/entities?collegeId=${id}`, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => live && setFound({ id, rows: j.success ? j.data : [] }))
            .catch(() => live && setFound({ id, rows: [] }));
        return () => { live = false; };
    }, [create, college]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (create && !college) return toast.error("Pick your college first");
        setBusy(true);
        const err = await onSubmit(d, college?._id);
        setBusy(false);
        if (err) toast.error(err);
    };

    const setCourse = (i: number, patch: Partial<CampusFormData["courses"][number]>) =>
        set("courses", d.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)));

    return (
        <form onSubmit={submit} className="space-y-5">
            {create && (
                <section className="plasma-card p-5 space-y-4">
                    <CollegePicker value={college} onChange={setCollege} />
                    {others.length > 0 && (
                        <div role="status" className="rounded-[var(--radius-sm)] border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-800">
                            <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> Campuses already exist for this college</p>
                            <ul className="mt-1.5 list-disc pl-6 text-xs">
                                {others.map((o) => (
                                    <li key={o._id}>{o.name} · {o.members} staff · created {new Date(o.createdAt).toLocaleDateString("en-IN")}{o.reportCount ? ` · ${o.reportCount} reported` : ""}</li>
                                ))}
                            </ul>
                            <p className="mt-1.5 text-xs">You can still create yours. Students tell them apart by the join code you share.</p>
                        </div>
                    )}
                </section>
            )}

            <section className="plasma-card p-5 space-y-4">
                <Input label="Campus name" value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="e.g. TCET Training & Placement Cell" required />
                <Field label="Description (optional)">
                    <textarea className={controlCls} rows={3} maxLength={2000} value={d.description} onChange={(e) => set("description", e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <ImageField label="Logo (optional)" value={d.logo} onChange={(u) => set("logo", u || undefined)} />
                    <ImageField label="Cover image (optional)" value={d.coverImage} onChange={(u) => set("coverImage", u || undefined)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Contact email (optional)" type="email" value={d.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} />
                    <Input label="Contact phone (optional)" value={d.contactPhone ?? ""} onChange={(e) => set("contactPhone", e.target.value)} maxLength={20} />
                </div>
            </section>

            <section className="plasma-card p-5 space-y-4">
                <h2 className="font-semibold text-[var(--heading)]">What students fill in</h2>
                <Input label="Student ID label" value={d.uidLabel} onChange={(e) => set("uidLabel", e.target.value)} maxLength={40} hint="What your college calls it, e.g. SAP ID or Roll number" />
                <TagInput
                    label="Graduation batches"
                    tags={d.batches.map(String)}
                    onChange={(t) => set("batches", t.map(Number).filter((n) => Number.isInteger(n)))}
                    placeholder="e.g. 2027, press Enter"
                />
                <div className="space-y-2">
                    <span className="label">Courses and departments (optional)</span>
                    <p className="text-xs text-[var(--text-3)]">Students pick from these. Leave empty to let them type their own.</p>
                    {d.courses.map((c, i) => (
                        <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 space-y-2">
                            <div className="flex items-end gap-2">
                                <div className="flex-1"><Input label="Course" value={c.name} onChange={(e) => setCourse(i, { name: e.target.value })} maxLength={80} placeholder="e.g. B.Tech" /></div>
                                <Button type="button" variant="ghost" size="sm" aria-label="Remove course" onClick={() => set("courses", d.courses.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                            </div>
                            <TagInput tags={c.departments} onChange={(t) => setCourse(i, { departments: t })} label="Departments" placeholder="e.g. Computer Engineering" />
                        </div>
                    ))}
                    {d.courses.length < 30 && (
                        <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => set("courses", [...d.courses, { name: "", departments: [] }])}><Plus className="h-3.5 w-3.5" /> Add course</Button>
                    )}
                </div>
            </section>

            <section className="plasma-card p-5 space-y-4">
                <h2 className="font-semibold text-[var(--heading)]">Visibility and policy</h2>
                <Field label="Listing" hint="Code only: students can join only with your code and the campus is not shown in their college's list.">
                    <select className={controlCls} value={d.listing} onChange={(e) => set("listing", e.target.value as CampusFormData["listing"])}>
                        <option value="listed">Listed for students of this college</option>
                        <option value="code_only">Join by code only</option>
                    </select>
                </Field>
                <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                    <input type="checkbox" className="mt-1" checked={d.policy.oneStudentOneOffer} onChange={(e) => set("policy", { ...d.policy, oneStudentOneOffer: e.target.checked })} />
                    <span>One student, one offer<span className="block text-xs text-[var(--text-3)]">Accepting an offer withdraws the student&apos;s other open applications here.</span></span>
                </label>
                <Input
                    label="Hours a student has to answer an offer (optional)"
                    type="number" min={1} max={720}
                    value={d.policy.acceptWindowHours ?? ""}
                    onChange={(e) => set("policy", { ...d.policy, acceptWindowHours: e.target.value })}
                />
            </section>

            <Button type="submit" loading={busy}>{create ? "Create campus" : "Save changes"}</Button>
        </form>
    );
}
