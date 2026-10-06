"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Ban, X } from "lucide-react";
import { toast } from "sonner";
import { ApplicationStatusChip } from "@/components/student/ApplicationStatusChip";
import { CompanyLogo } from "@/components/internships/CompanyLogo";
import { StipendBadge } from "@/components/internships/StipendBadge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStudent } from "@/components/student/StudentProvider";
import { sourceLabel } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { APPLICATION_STATUS_LABEL, PIPELINE_STAGES, type AppliedDetail } from "@/types/student-application";

type Step = { key: string; label: string; at?: string; state: "done" | "current" | "upcoming" | "bad" };

/** Reached stages with their dates, then (while the application is open) the stages still ahead. */
function buildSteps(a: AppliedDetail): Step[] {
  const at = new Map(a.timeline.map((t) => [t.status, t.at]));
  const reached = PIPELINE_STAGES.filter((s) => at.has(s));
  const steps: Step[] = reached.map((s) => ({ key: s, label: APPLICATION_STATUS_LABEL[s], at: at.get(s), state: s === a.status ? "current" : "done" }));
  if (a.status === "rejected" || a.status === "withdrawn") {
    steps.push({ key: a.status, label: APPLICATION_STATUS_LABEL[a.status], at: at.get(a.status), state: "bad" });
  } else if (a.status !== "hired") {
    const last = PIPELINE_STAGES.indexOf(a.status as (typeof PIPELINE_STAGES)[number]);
    for (const s of PIPELINE_STAGES.slice(last + 1)) steps.push({ key: s, label: APPLICATION_STATUS_LABEL[s], state: "upcoming" });
  }
  return steps;
}

export default function AppliedInternshipPage() {
  const { username, internshipId } = useParams<{ username: string; internshipId: string }>();
  const { mutate } = useStudent();
  const [item, setItem] = useState<AppliedDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/user/applications/${internshipId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => (j.success ? setItem(j.data) : setError(j.error)))
      .catch(() => setError("Unable to load application"));
  }, [internshipId]);
  useEffect(load, [load]);

  const withdraw = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/user/applications/${internshipId}/withdraw`, { method: "POST", credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("Application withdrawn");
      setConfirming(false);
      load();
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to withdraw");
    } finally {
      setBusy(false);
    }
  };

  const back = (
    <Link href={`/user/${username}/applied-internships`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-2)] hover:text-[var(--text)] mb-4">
      <ArrowLeft className="h-4 w-4" /> Applied internships
    </Link>
  );

  if (error) return <div>{back}<p className="text-sm text-[var(--danger)]">{error}</p></div>;
  if (!item) return <div>{back}<Skeleton className="h-40 max-w-3xl" /></div>;

  const { internship: i } = item;
  const steps = item.tracked ? buildSteps(item) : [];

  return (
    <div className="max-w-3xl">
      {back}

      <div className="plasma-card p-5 flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] text-[var(--primary)] font-semibold flex items-center justify-center">
          <CompanyLogo internship={i} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--text)]">{i.name}</h2>
          <p className="text-sm text-[var(--text-2)]">{i.company} · {sourceLabel(i.source)}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StipendBadge stipend={i.stipend} />
            <span className="text-xs text-[var(--text-3)]">Applied {formatDate(item.appliedAt)}</span>
          </div>
        </div>
        {item.tracked && <ApplicationStatusChip status={item.status} />}
      </div>

      <div className="plasma-card p-5 mt-4">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Status</h3>
        {item.tracked ? (
          <ol className="space-y-0">
            {steps.map((s, idx) => (
              <li key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-white shrink-0",
                    s.state === "done" && "bg-emerald-500",
                    s.state === "current" && "bg-[var(--primary)] ring-4 ring-[var(--primary-bg)]",
                    s.state === "bad" && (s.key === "rejected" ? "bg-red-500" : "bg-gray-400"),
                    s.state === "upcoming" && "bg-[var(--surface-2)] border border-[var(--border)]",
                  )}>
                    {s.state === "done" || s.state === "current" ? <Check className="h-3.5 w-3.5" /> : s.state === "bad" ? (s.key === "rejected" ? <X className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />) : null}
                  </span>
                  {idx < steps.length - 1 && <span className={cn("w-px flex-1 min-h-6", s.state === "upcoming" ? "bg-[var(--border)]" : "bg-emerald-300")} />}
                </div>
                <div className="pb-5">
                  <p className={cn("text-sm font-medium", s.state === "upcoming" ? "text-[var(--text-3)]" : "text-[var(--text)]")}>{s.label}</p>
                  {s.at && <p className="text-xs text-[var(--text-3)]">{formatDate(s.at)}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-sm text-[var(--text-2)] space-y-2">
            <p>You applied on {sourceLabel(i.source)}. Updates on this application come from there, so there is no status to track here.</p>
            {i.applyLink && (
              <a href={i.applyLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--primary)] hover:underline">
                Open on {sourceLabel(i.source)} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {item.tracked && (item.coverLetter || item.answers.length > 0) && (
        <div className="plasma-card p-5 mt-4 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Your application</h3>
          {item.coverLetter && (
            <div>
              <p className="text-xs font-medium text-[var(--text-3)] mb-1">Cover letter</p>
              <p className="text-sm text-[var(--text-2)] whitespace-pre-wrap">{item.coverLetter}</p>
            </div>
          )}
          {item.answers.map((a, idx) => (
            <div key={idx}>
              <p className="text-xs font-medium text-[var(--text-3)] mb-1">{a.question}</p>
              <p className="text-sm text-[var(--text-2)]">{a.answer}</p>
            </div>
          ))}
        </div>
      )}

      {item.canWithdraw && (
        <div className="mt-4">
          {confirming ? (
            <div className="plasma-card p-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--text)] flex-1 min-w-48">Withdraw this application? You will not be able to apply to it again.</p>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>Keep it</Button>
              <Button variant="danger" size="sm" onClick={withdraw} disabled={busy}>Withdraw</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>Withdraw application</Button>
          )}
        </div>
      )}
    </div>
  );
}
