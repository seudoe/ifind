"use client";

import { useRef, useState } from "react";
import { Controller, useForm, type FieldPath, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { companySchema, type CompanyInput } from "@/lib/employer/validation";
import { cn } from "@/lib/utils";
import { COMPANY_SIZES, COMPANY_TYPES } from "@/types/employer";

export const controlCls =
    "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:border-[var(--border-2)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
const labelCls = "text-xs font-medium text-[var(--text-2)] uppercase tracking-wide";

type FieldName = FieldPath<CompanyInput>;

const STEPS: { title: string; fields: FieldName[] }[] = [
    { title: "Identity", fields: ["name", "legalName", "tagline", "description", "logo", "coverImage", "website"] },
    { title: "Classification", fields: ["industry", "companyType", "size", "foundedYear"] },
    { title: "Location & contact", fields: ["headquarters", "officeLocations", "contactEmail", "contactPhone"] },
    { title: "Socials & extras", fields: ["socials", "registration", "perks", "techStack"] },
];

export const EMPTY_COMPANY: Partial<CompanyInput> = {
    name: "", description: "", industry: "", companyType: "startup", size: "1-10", contactEmail: "",
    headquarters: { city: "", country: "India" },
    officeLocations: [], perks: [], techStack: [], socials: {}, registration: {},
};

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className={labelCls}>{label}</span>
            {children}
            {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : hint && <p className="text-xs text-[var(--text-3)]">{hint}</p>}
        </div>
    );
}

function ImageField({ label, value, onChange }: { label: string; value?: string; onChange: (url: string) => void }) {
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const upload = async (file: File) => {
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/employer/uploads", { method: "POST", body: fd, credentials: "include" });
            const j = await res.json();
            if (!j.success) throw new Error(j.error);
            onChange(j.data.url);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setBusy(false);
        }
    };
    return (
        <Field label={label} hint="JPG, PNG or WebP, up to 2MB">
            <div className="flex items-center gap-3">
                {value ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={value} alt={label} className="h-14 w-14 rounded-[var(--radius-sm)] object-cover border border-[var(--border)]" />
                ) : (
                    <div className="h-14 w-14 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-2)] flex items-center justify-center text-[var(--text-3)]">
                        <ImagePlus className="h-5 w-5" />
                    </div>
                )}
                <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => ref.current?.click()}>{value ? "Replace" : "Upload"}</Button>
                {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>Remove</Button>}
            </div>
        </Field>
    );
}

interface Props {
    mode: "create" | "edit";
    initial?: Partial<CompanyInput>;
    /** Resolves to an error message, or null on success. */
    onSubmit: (data: CompanyInput) => Promise<string | null>;
}

export function CompanyForm({ mode, initial, onSubmit }: Props) {
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const form = useForm<CompanyInput>({
        resolver: zodResolver(companySchema) as unknown as Resolver<CompanyInput>,
        defaultValues: { ...EMPTY_COMPANY, ...initial } as CompanyInput,
        mode: "onTouched",
    });
    const { register, control, trigger, handleSubmit, getValues, formState: { errors } } = form;

    const create = mode === "create";
    const isReview = create && step === STEPS.length;
    const show = (i: number) => !create || step === i;
    const e = (msg?: { message?: string }) => msg?.message;

    const next = async () => {
        if (await trigger(STEPS[step].fields)) setStep(step + 1);
        else toast.error("Fix the highlighted fields to continue");
    };

    const submit = handleSubmit(async (data) => {
        setSubmitting(true);
        const err = await onSubmit(data);
        setSubmitting(false);
        if (err) toast.error(err);
    }, () => toast.error("Some fields are invalid"));

    return (
        <form
            onSubmit={(ev) => {
                ev.preventDefault();
                // Enter inside an early step advances instead of submitting
                if (create && !isReview) next();
                else submit(ev);
            }}
            className="space-y-5"
        >
            {create && (
                <ol className="flex flex-wrap gap-2 text-xs">
                    {[...STEPS.map((s) => s.title), "Review"].map((t, i) => (
                        <li key={t} className={cn("rounded-full px-3 py-1 border", i === step ? "bg-[var(--primary)] text-white border-[var(--primary)]" : i < step ? "bg-[var(--primary-bg)] text-[var(--primary)] border-transparent" : "text-[var(--text-3)] border-[var(--border)]")}>
                            {i + 1}. {t}
                        </li>
                    ))}
                </ol>
            )}

            {show(0) && (
                <section className="plasma-card p-5 space-y-4">
                    {!create && <h2 className="font-semibold text-[var(--text)]">Identity</h2>}
                    <Input label="Company name" {...register("name")} error={e(errors.name)} maxLength={120} />
                    <Input label="Legal name (optional)" {...register("legalName")} error={e(errors.legalName)} />
                    <Input label="Tagline (optional)" {...register("tagline")} error={e(errors.tagline)} maxLength={120} />
                    <Field label="Description" error={e(errors.description)} hint="Plain text, up to 5000 characters">
                        <textarea rows={5} className={controlCls} maxLength={5000} {...register("description")} />
                    </Field>
                    <Controller control={control} name="logo" render={({ field }) => <ImageField label="Logo" value={field.value} onChange={field.onChange} />} />
                    <Controller control={control} name="coverImage" render={({ field }) => <ImageField label="Cover image" value={field.value} onChange={field.onChange} />} />
                    <Input label="Website (optional)" placeholder="https://…" {...register("website")} error={e(errors.website)} />
                </section>
            )}

            {show(1) && (
                <section className="plasma-card p-5 space-y-4">
                    {!create && <h2 className="font-semibold text-[var(--text)]">Classification</h2>}
                    <Input label="Industry" placeholder="e.g. Software, Fintech" {...register("industry")} error={e(errors.industry)} />
                    <Field label="Company type" error={e(errors.companyType)}>
                        <select className={cn(controlCls, "capitalize")} {...register("companyType")}>
                            {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label="Size" error={e(errors.size)}>
                        <select className={controlCls} {...register("size")}>
                            {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                        </select>
                    </Field>
                    <Input label="Founded year (optional)" type="number" {...register("foundedYear")} error={e(errors.foundedYear)} />
                </section>
            )}

            {show(2) && (
                <section className="plasma-card p-5 space-y-4">
                    {!create && <h2 className="font-semibold text-[var(--text)]">Location & contact</h2>}
                    <Input label="Address line 1 (optional)" {...register("headquarters.line1")} />
                    <Input label="Address line 2 (optional)" {...register("headquarters.line2")} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="City" {...register("headquarters.city")} error={e(errors.headquarters?.city)} />
                        <Input label="State (optional)" {...register("headquarters.state")} />
                        <Input label="Country" {...register("headquarters.country")} error={e(errors.headquarters?.country)} />
                        <Input label="Pincode (optional)" {...register("headquarters.pincode")} />
                    </div>
                    <Controller control={control} name="officeLocations" render={({ field }) => <TagInput label="Other office locations" tags={field.value ?? []} onChange={field.onChange} placeholder="Add a city and press Enter" />} />
                    <Input label="Contact email" type="email" {...register("contactEmail")} error={e(errors.contactEmail)} />
                    <Input label="Contact phone (optional)" {...register("contactPhone")} />
                </section>
            )}

            {show(3) && (
                <section className="plasma-card p-5 space-y-4">
                    {!create && <h2 className="font-semibold text-[var(--text)]">Socials & extras</h2>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="LinkedIn" placeholder="https://linkedin.com/company/…" {...register("socials.linkedin")} error={e(errors.socials?.linkedin)} />
                        <Input label="Twitter / X" {...register("socials.twitter")} error={e(errors.socials?.twitter)} />
                        <Input label="Instagram" {...register("socials.instagram")} error={e(errors.socials?.instagram)} />
                        <Input label="GitHub" {...register("socials.github")} error={e(errors.socials?.github)} />
                    </div>
                    <p className="text-xs text-[var(--text-3)]">Registration details are optional and used for future company verification.</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input label="GSTIN" {...register("registration.gstin")} error={e(errors.registration?.gstin)} />
                        <Input label="CIN" {...register("registration.cin")} error={e(errors.registration?.cin)} />
                        <Input label="PAN" {...register("registration.pan")} error={e(errors.registration?.pan)} />
                    </div>
                    <Controller control={control} name="perks" render={({ field }) => <TagInput label="Perks" tags={field.value ?? []} onChange={field.onChange} placeholder="e.g. Flexible hours" />} />
                    <Controller control={control} name="techStack" render={({ field }) => <TagInput label="Tech stack" tags={field.value ?? []} onChange={field.onChange} placeholder="e.g. React" />} />
                </section>
            )}

            {isReview && (() => {
                const v = getValues();
                const rows: [string, string][] = [
                    ["Name", v.name], ["Industry", v.industry], ["Type", v.companyType], ["Size", v.size],
                    ["Headquarters", [v.headquarters.city, v.headquarters.state, v.headquarters.country].filter(Boolean).join(", ")],
                    ["Contact", v.contactEmail], ["Website", v.website ?? "-"],
                ];
                return (
                    <section className="plasma-card p-5">
                        <h2 className="font-semibold text-[var(--text)] mb-3">Review</h2>
                        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                            {rows.map(([k, val]) => (
                                <div key={k}><dt className="text-xs text-[var(--text-3)]">{k}</dt><dd className="text-[var(--text)] break-words">{val}</dd></div>
                            ))}
                        </dl>
                        <p className="text-xs text-[var(--text-3)] mt-4">Your company starts as <strong>unverified</strong>. Its internships go through moderator review before students see them.</p>
                    </section>
                );
            })()}

            <div className="flex justify-between gap-3">
                {create ? (
                    <>
                        <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
                        {isReview ? (
                            <Button type="submit" loading={submitting}>Register company</Button>
                        ) : (
                            <Button type="button" onClick={next}>Next</Button>
                        )}
                    </>
                ) : (
                    <Button type="submit" loading={submitting}>Save changes</Button>
                )}
            </div>
        </form>
    );
}
