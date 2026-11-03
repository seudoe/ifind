"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { controlCls } from "@/components/employer/CompanyForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import type { EnrollmentView } from "@/types/campusStudent";

interface Question { _id: string; question: string; type: "text" | "yes_no" | "single_choice" | "multi_choice" | "number"; options: string[]; required: boolean }
interface Detail { _id: string; company: { name: string }; designation: string; requireResume: boolean; screeningQuestions: Question[] }

type Answer = string | string[];

/** Apply form: confirm the details staff will see, optional cover letter, screening answers. The server re-checks every rule. */
export function ApplyDialog({ internshipId, enrollment, onClose, onDone }: { internshipId: string; enrollment: EnrollmentView; onClose: () => void; onDone: () => void }) {
    const { username } = useParams<{ username: string }>();
    const [d, setD] = useState<Detail | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<string, Answer>>({});
    const [cover, setCover] = useState("");
    const [sure, setSure] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<{ message: string; code?: string; reasons?: string[] } | null>(null);

    useEffect(() => {
        let live = true;
        fetch(`/api/user/campus/internships/${internshipId}`, { credentials: "include" }).then((r) => r.json())
            .then((j) => { if (!live) return; if (j.success) setD(j.data); else setLoadError(j.error ?? "Unable to load"); })
            .catch(() => live && setLoadError("Unable to load"));
        return () => { live = false; };
    }, [internshipId]);

    const set = (id: string, v: Answer) => setAnswers((a) => ({ ...a, [id]: v }));

    const submit = async () => {
        if (!d) return;
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/user/campus/internships/${internshipId}/apply`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm: true, coverLetter: cover, answers: d.screeningQuestions.map((q) => ({ questionId: q._id, answer: answers[q._id] ?? "" })) }),
        });
        const j = await res.json().catch(() => ({ success: false, error: "Something went wrong" }));
        setBusy(false);
        if (!j.success) return setError({ message: j.error, code: j.code, reasons: j.reasons });
        toast.success("Application sent");
        onDone();
    };

    return (
        <Modal open onClose={onClose} title={d ? `Apply to ${d.company.name}` : "Apply"} description={d?.designation} size="lg">
            {loadError ? <p className="text-sm text-[var(--danger)]">{loadError}</p> : !d ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-24" /></div> : (
                <div className="space-y-4">
                    <section className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-sm space-y-0.5">
                        <p className="label mb-1">The placement team will see</p>
                        <p>{enrollment.course}, {enrollment.department} · Batch {enrollment.batch}</p>
                        <p>ID <span className="font-mono">{enrollment.collegeUid}</span> · CGPA {enrollment.cgpa ?? "not set"} · Backlogs {enrollment.activeBacklogs ?? "not set"}</p>
                        <p>{enrollment.phone ?? "No phone saved"}</p>
                        <p className="pt-1 text-xs text-[var(--text-3)]">{d.requireResume ? "Your uploaded resume is attached." : "A resume is optional here."} <Link href={`/user/${username}/campus/details`} className="text-[var(--primary)] underline">Edit details</Link></p>
                    </section>

                    {d.screeningQuestions.map((q) => (
                        <div key={q._id} className="space-y-1">
                            <label className="text-sm font-medium text-[var(--text)]" htmlFor={`q-${q._id}`}>{q.question}{q.required && <span className="text-[var(--danger)]"> *</span>}</label>
                            {q.type === "text" && <textarea id={`q-${q._id}`} rows={2} maxLength={1000} className={controlCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)} />}
                            {q.type === "number" && <input id={`q-${q._id}`} type="number" className={controlCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)} />}
                            {(q.type === "yes_no" || q.type === "single_choice") && (
                                <select id={`q-${q._id}`} className={controlCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)}>
                                    <option value="">Select…</option>
                                    {(q.type === "yes_no" ? ["Yes", "No"] : q.options).map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                            )}
                            {q.type === "multi_choice" && (
                                <div className="flex flex-wrap gap-3">
                                    {q.options.map((o) => {
                                        const cur = (answers[q._id] as string[]) ?? [];
                                        return <label key={o} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--campus)]" checked={cur.includes(o)} onChange={(e) => set(q._id, e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />{o}</label>;
                                    })}
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="space-y-1">
                        <label htmlFor="cover" className="text-sm font-medium text-[var(--text)]">Cover letter <span className="text-xs font-normal text-[var(--text-3)]">(optional)</span></label>
                        <textarea id="cover" rows={3} maxLength={5000} className={controlCls} value={cover} onChange={(e) => setCover(e.target.value)} />
                    </div>

                    <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--campus)]" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                        My details above are correct. Staff can remove or bar students whose details are wrong.
                    </label>

                    {error && (
                        <div role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                            <p>{error.message}</p>
                            {error.reasons && <ul className="mt-1 list-disc pl-5 text-xs">{error.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                            {error.code === "resume_required" && <Link href={`/user/${username}/resume`} className="mt-1 inline-block underline">Upload your resume</Link>}
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button disabled={!sure} loading={busy} onClick={submit}>Send application</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
