"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TagInput } from "@/components/ui/TagInput";
import { safeHref } from "@/lib/safeUrl";
import { formatDate } from "@/lib/utils";
import type { Internship, User } from "@/types";
import type { ParsedResumeData } from "@/types/resume";

type Answers = Record<string, string | string[]>;

export interface ApplicantDetails { name: string; phone: string; city: string; state: string; skills: string[] }

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]";

const detailsOf = (u: User): ApplicantDetails => ({
  name: u.name ?? "", phone: u.phone ?? "", city: u.city ?? "", state: u.state ?? "", skills: [...(u.skills ?? [])],
});

const sameSkills = (a: string[], b: string[]) => a.length === b.length && a.every((s) => b.includes(s));

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="label pb-1.5 border-b border-[var(--border)]">{title}</h3>
      {children}
    </section>
  );
}

interface Props {
  open: boolean;
  internship: Internship;
  user: User;
  applying: boolean;
  error: string | null;
  /** Re-reads the student (after the profile or resume changed). */
  onRefreshUser: () => Promise<void>;
  onClose: () => void;
  onSubmit: (payload: { coverLetter: string; answers: Answers; applicant: ApplicantDetails & { profileUpdated: boolean } }) => void;
}

/**
 * The apply pop-up for iFind-posted internships: a quick resume view (with replace), the student's details to
 * confirm or edit, then the employer's cover letter / screening questions. Whatever is in the form when they
 * submit is stored with the application; "Apply these changes to my profile" additionally saves them to the profile.
 */
export function ApplicationDialog({ open, internship, user, applying, error, onRefreshUser, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ApplicantDetails>(() => detailsOf(user));
  const [coverLetter, setCoverLetter] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [savedToProfile, setSavedToProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState<null | "uploading" | "saving">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const questions = internship.screeningQuestions ?? [];
  const base = useMemo(() => detailsOf(user), [user]);
  const dirty = form.name !== base.name || form.phone !== base.phone || form.city !== base.city || form.state !== base.state || !sameSkills(form.skills, base.skills);

  const resume = user.resume;
  const parsed = (resume?.parsedData ?? null) as Partial<ParsedResumeData> | null;
  const edu = parsed?.education?.[0];
  const hasResume = Boolean(resume?.driveViewLink || parsed);

  const set = (qid: string, v: string | string[]) => setAnswers((a) => ({ ...a, [qid]: v }));
  const field = (key: keyof Omit<ApplicantDetails, "skills">) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSavedToProfile(false); setForm((f) => ({ ...f, [key]: e.target.value })); },
  });

  const saveToProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userUpdate: { name: form.name, phone: form.phone, city: form.city, state: form.state, skills: form.skills } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not update your profile");
      await onRefreshUser();
      setSavedToProfile(true);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update your profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const replaceResume = async (file: File) => {
    if (file.type !== "application/pdf") return toast.error("Only PDF files are accepted.");
    if (file.size > 5 * 1024 * 1024) return toast.error("File size must be under 5MB.");
    setUploading("uploading");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const up = await fetch("/api/user/resume/upload-temp", { method: "POST", body: fd, credentials: "include" });
      const upJson = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upJson.error ?? "Upload failed");
      if (!upJson.data?.autoCommitted) {
        // They chose to replace it right here, so the new file goes live straight away
        setUploading("saving");
        const commit = await fetch("/api/user/resume/commit", { method: "POST", credentials: "include" });
        const cJson = await commit.json().catch(() => ({}));
        if (!commit.ok) throw new Error(cJson.error ?? "Could not save the new resume");
      }
      await onRefreshUser();
      toast.success("Resume updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resume upload failed");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = () =>
    onSubmit({ coverLetter, answers, applicant: { ...form, name: form.name.trim(), skills: form.skills, profileUpdated: savedToProfile } });

  return (
    // Dialog events bubble through the React tree: keep them from opening the card's detail view
    <span onClick={(e) => e.stopPropagation()}>
      <Modal open={open} onClose={() => !applying && onClose()} title={`Apply to ${internship.name}`} description={internship.company} size="lg">
        <div className="space-y-6">
          <Block title="Your details">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Full name" {...field("name")} />
              <Input label="Email" value={user.email} readOnly disabled hint="From your account" />
              <Input label="Phone" {...field("phone")} placeholder="+91 …" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" {...field("city")} />
                <Input label="State" {...field("state")} />
              </div>
            </div>
            <TagInput label="Skills" tags={form.skills} onChange={(skills) => { setSavedToProfile(false); setForm((f) => ({ ...f, skills })); }} placeholder="Add a skill and press Enter" />
          </Block>

          <Block title="Resume">
            {hasResume ? (
              <div className="flex gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <FileText className="h-9 w-9 shrink-0 text-[var(--primary)]" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[13px] font-semibold text-[var(--heading)]">
                    {resume?.uploadedAt ? `Uploaded ${formatDate(resume.uploadedAt)}` : "Your resume"}
                  </p>
                  {parsed?.summary && <p className="text-xs text-[var(--text-2)] line-clamp-2">{parsed.summary}</p>}
                  <p className="text-xs text-[var(--text-3)]">
                    {[edu ? `${edu.field?.course ?? ""} · ${edu.institution}`.replace(/^ · /, "") : null,
                      parsed?.workHistory?.length ? `${parsed.workHistory.length} experience${parsed.workHistory.length > 1 ? "s" : ""}` : null,
                      parsed?.projects?.length ? `${parsed.projects.length} project${parsed.projects.length > 1 ? "s" : ""}` : null]
                      .filter(Boolean).join("  ·  ") || "Parsed resume on file"}
                  </p>
                  {resume?.driveViewLink && (
                    <a href={safeHref(resume.driveViewLink)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
                      View resume <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-2)] p-3 text-sm text-[var(--text-2)]">
                {internship.requireResume ? "This internship needs a resume. Upload one to continue." : "No resume on file. You can still apply, or upload one now."}
              </p>
            )}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && replaceResume(e.target.files[0])} />
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={!!uploading || applying}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading === "uploading" ? "Reading your resume…" : uploading === "saving" ? "Saving…" : hasResume ? "Update resume (PDF)" : "Upload resume (PDF)"}
            </Button>
          </Block>

          {(internship.requireCoverLetter || questions.length > 0) && (
            <Block title="From the employer">
              {internship.requireCoverLetter && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[var(--text)]">Cover letter *</span>
                  <textarea rows={5} maxLength={5000} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} className={inputCls} placeholder="Why are you a good fit?" />
                </label>
              )}
              {questions.map((q) => (
                <div key={q._id} className="space-y-1">
                  <span className="block text-xs font-semibold text-[var(--text)]">{q.question}{q.required && " *"}</span>
                  {q.type === "text" && <textarea rows={2} maxLength={1000} className={inputCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)} />}
                  {q.type === "number" && <input type="number" className={inputCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)} />}
                  {(q.type === "yes_no" || q.type === "single_choice") &&
                    (q.type === "yes_no" ? ["Yes", "No"] : q.options).map((o) => (
                      <label key={o} className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                        <input type="radio" name={q._id} checked={answers[q._id] === o} onChange={() => set(q._id, o)} className="accent-[var(--primary)]" />
                        {o}
                      </label>
                    ))}
                  {q.type === "multi_choice" &&
                    q.options.map((o) => {
                      const cur = (answers[q._id] as string[]) ?? [];
                      return (
                        <label key={o} className="flex items-center gap-2 text-sm text-[var(--text-2)]">
                          <input type="checkbox" checked={cur.includes(o)} onChange={() => set(q._id, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])} className="accent-[var(--primary)]" />
                          {o}
                        </label>
                      );
                    })}
                </div>
              ))}
            </Block>
          )}

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          {(dirty || savedToProfile) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--primary)]/40 bg-[var(--primary-bg)] px-3 py-2.5">
              <p className="text-xs text-[var(--text-2)]">
                {savedToProfile ? "Saved to your profile." : "You edited your details. They go to the employer with this application either way."}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={saveToProfile} loading={savingProfile} disabled={savedToProfile || savingProfile || applying}>
                {savedToProfile ? <><Check className="h-3.5 w-3.5" /> Applied to profile</> : "Apply these changes to my profile"}
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={applying}>Cancel</Button>
            <Button size="sm" onClick={submit} loading={applying} disabled={!form.name.trim() || !!uploading || (internship.requireResume && !hasResume)}>Submit application</Button>
          </div>
        </div>
      </Modal>
    </span>
  );
}
