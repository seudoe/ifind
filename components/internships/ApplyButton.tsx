"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { sourceLabel } from "@/lib/constants";
import { getInternshipId } from "@/lib/utils";
import type { Internship } from "@/types";

interface Props {
  internship: Internship;
  isApplied: boolean;
  onApplied: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
}

type Answers = Record<string, string | string[]>;

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]";

/** One apply button for card, pop-up and mobile view: "Apply on {Source}" for scraped listings, "Apply" for iFind posts. */
export function ApplyButton({ internship, isApplied, onApplied, size = "sm", className }: Props) {
  const router = useRouter();
  const username = useParams()?.username as string | undefined;
  const [applying, setApplying] = useState(false);
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const id = getInternshipId(internship);
  const onPlatform = internship.source === "ifind";
  const questions = internship.screeningQuestions ?? [];
  const needsForm = onPlatform && (internship.requireCoverLetter || questions.length > 0);

  const submit = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/internships/${id}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter,
          answers: questions.map((q) => ({ questionId: q._id, answer: answers[q._id] })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(onPlatform ? "Application sent to the employer" : "Application recorded!");
      setOpen(false);
      onApplied(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply";
      if (open) setError(message);
      else toast.error(message);
    } finally {
      setApplying(false);
    }
  };

  const click = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isApplied) {
      // Applied: the button opens the application's status page (student area only)
      if (username) router.push(`/user/${username}/applied-internships/${id}`);
      return;
    }
    if (needsForm) return setOpen(true);
    // Open the source site synchronously to bypass popup blockers
    if (!onPlatform && internship.applyLink) {
      // mailto: (Telegram email-apply posts) opens the mail client instead of a new tab
      if (internship.applyLink.startsWith("mailto:")) window.location.href = internship.applyLink;
      else window.open(internship.applyLink, "_blank");
    }
    void submit();
  };

  const set = (qid: string, v: string | string[]) => setAnswers((a) => ({ ...a, [qid]: v }));

  return (
    <>
      <Button
        size={size}
        variant="primary"
        className={className}
        onClick={click}
        loading={applying && !open}
        title={isApplied ? "View application status" : undefined}
      >
        {isApplied ? "Applied ✓" : onPlatform ? "Apply" : internship.applyLink?.startsWith("mailto:") ? "Apply by email" : `Apply on ${sourceLabel(internship.source)}`}
      </Button>

      {needsForm && (
        // Dialog events bubble through the React tree: keep them from opening the card's detail view
        <span onClick={(e) => e.stopPropagation()}>
          <Modal open={open} onClose={() => !applying && setOpen(false)} title={`Apply to ${internship.name}`} description={internship.company}>
            <div className="space-y-4">
              {internship.requireCoverLetter && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[var(--text)]">Cover letter *</span>
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className={inputCls}
                    placeholder="Why are you a good fit?"
                  />
                </label>
              )}
              {questions.map((q) => (
                <div key={q._id} className="space-y-1">
                  <span className="block text-xs font-semibold text-[var(--text)]">
                    {q.question}
                    {q.required && " *"}
                  </span>
                  {q.type === "text" && (
                    <textarea rows={2} maxLength={1000} className={inputCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)} />
                  )}
                  {q.type === "number" && (
                    <input type="number" className={inputCls} value={(answers[q._id] as string) ?? ""} onChange={(e) => set(q._id, e.target.value)} />
                  )}
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
                          <input
                            type="checkbox"
                            checked={cur.includes(o)}
                            onChange={() => set(q._id, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o])}
                            className="accent-[var(--primary)]"
                          />
                          {o}
                        </label>
                      );
                    })}
                </div>
              ))}
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={applying}>Cancel</Button>
                <Button size="sm" onClick={() => void submit()} loading={applying}>Submit application</Button>
              </div>
            </div>
          </Modal>
        </span>
      )}
    </>
  );
}
