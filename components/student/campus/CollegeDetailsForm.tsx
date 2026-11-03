"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CollegePicker, type PickedCollege } from "@/components/employer/CollegePicker";
import { controlCls, Field } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CampusSummaryView, EnrollmentView } from "@/types/campusStudent";

interface Props {
    initial?: EnrollmentView | null;
    college?: { _id: string; name: string } | null;
    /** The joined campus, if any: supplies the ID label and course/department options. */
    current?: CampusSummaryView | null;
    onSaved: () => void;
}

const num = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const nextYears = () => Array.from({ length: 7 }, (_, i) => new Date().getFullYear() + i);

/** College details. Works with no campus joined (the student can fill everything before one exists). */
export function CollegeDetailsForm({ initial, college: initialCollege, current, onSaved }: Props) {
    const joined = !!initial?.entityId;
    const [college, setCollege] = useState<PickedCollege | null>(initialCollege ?? null);
    const [f, setF] = useState({
        course: initial?.course ?? "", department: initial?.department ?? "", collegeUid: initial?.collegeUid ?? "",
        batch: num(initial?.batch) || String(new Date().getFullYear() + 1), currentYear: num(initial?.currentYear), cgpa: num(initial?.cgpa),
        activeBacklogs: num(initial?.activeBacklogs), phone: initial?.phone ?? "", collegeEmail: initial?.collegeEmail ?? "", section: initial?.section ?? "",
    });
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

    const courses = current?.courses ?? [];
    const departments = [...new Set(courses.filter((c) => !f.course || c.name.toLowerCase() === f.course.toLowerCase()).flatMap((c) => c.departments))];
    const uidLabel = current?.uidLabel ?? "College ID";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!college) return toast.error("Pick your college");
        setBusy(true);
        const res = await fetch("/api/user/campus/enrollment", {
            method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ collegeId: college._id, ...f }),
        });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to save" }));
        setBusy(false);
        if (!j.success) return toast.error(j.error);
        toast.success("College details saved");
        onSaved();
    };

    return (
        <form onSubmit={submit} className="space-y-5 max-w-2xl">
            <section className="plasma-card p-5 space-y-4">
                {joined && college ? (
                    <Field label="College" hint="Leave your campus first if you need to change your college.">
                        <p className="text-sm font-medium text-[var(--text)]">{college.name}</p>
                    </Field>
                ) : (
                    <CollegePicker value={college} onChange={setCollege} endpoint="/api/user/campus/colleges" />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <Input label="Course" value={f.course} onChange={(e) => set("course", e.target.value)} list="campus-courses" placeholder="e.g. B.Tech" required maxLength={120} />
                        <datalist id="campus-courses">{courses.map((c) => <option key={c.name} value={c.name} />)}</datalist>
                    </div>
                    <div>
                        <Input label="Department" value={f.department} onChange={(e) => set("department", e.target.value)} list="campus-departments" placeholder="e.g. Computer Engineering" required maxLength={120} />
                        <datalist id="campus-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
                    </div>
                    <Input label={uidLabel} value={f.collegeUid} onChange={(e) => set("collegeUid", e.target.value)} required maxLength={60} hint="Staff see this next to your applications." />
                    <Field label="Graduation year (batch)">
                        <select className={controlCls} value={f.batch} onChange={(e) => set("batch", e.target.value)} required>
                            {nextYears().map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </Field>
                </div>
            </section>

            <section className="plasma-card p-5 space-y-4">
                <h2 className="font-semibold text-[var(--heading)]">More about you <span className="text-xs font-normal text-[var(--text-3)]">(optional, but eligibility checks use them)</span></h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Current year" type="number" min={1} max={8} value={f.currentYear} onChange={(e) => set("currentYear", e.target.value)} />
                    <Input label="CGPA" type="number" min={0} max={100} step="0.01" value={f.cgpa} onChange={(e) => set("cgpa", e.target.value)} />
                    <Input label="Active backlogs" type="number" min={0} value={f.activeBacklogs} onChange={(e) => set("activeBacklogs", e.target.value)} />
                    <Input label="Section / division" value={f.section} onChange={(e) => set("section", e.target.value)} maxLength={20} />
                    <Input label="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91…" maxLength={20} />
                    <Input label="College email" type="email" value={f.collegeEmail} onChange={(e) => set("collegeEmail", e.target.value)} />
                </div>
                <p className="text-xs text-[var(--text-3)]">Only the staff of the campus you join can see these. They are self-declared, and staff can remove or bar students whose details turn out to be wrong.</p>
            </section>

            <Button type="submit" loading={busy}>{initial ? "Save details" : "Save and continue"}</Button>
        </form>
    );
}
