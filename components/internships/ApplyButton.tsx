"use client";

import { safeHref } from "@/lib/safeUrl";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { track } from "@/lib/analytics/track";
import { Button } from "@/components/ui/Button";
import { ApplicationDialog, type ApplicantDetails } from "@/components/internships/ApplicationDialog";
import { useOptionalStudent } from "@/components/student/StudentProvider";
import { sourceLabel } from "@/lib/constants";
import { getInternshipId } from "@/lib/utils";
// DEADLINE-PASSED (disabled for now): import { deadlineState, getInternshipId } from "@/lib/utils";
import type { Internship } from "@/types";

interface Props {
  internship: Internship;
  isApplied: boolean;
  onApplied: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
}

type Answers = Record<string, string | string[]>;


/** One apply button for card, pop-up and mobile view: "Apply on {Source}" for scraped listings, "Apply" for iFind posts. */
export function ApplyButton({ internship, isApplied, onApplied, size = "sm", className }: Props) {
  const router = useRouter();
  const username = useParams()?.username as string | undefined;
  const [applying, setApplying] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = getInternshipId(internship);
  const onPlatform = internship.source === "ifind";
  // DEADLINE-PASSED (disabled for now): const closed = !isApplied && deadlineState(internship.deadlineDate).passed;
  // then on the Button: disabled={closed}, title "The application deadline has passed", and the label "Deadline passed" when closed
  const student = useOptionalStudent();
  // iFind posts always open the apply pop-up (details, resume, employer questions); scraped listings go to the source site
  const needsForm = onPlatform && Boolean(student?.data?.user);

  const submit = async (payload?: { coverLetter: string; answers: Answers; applicant: ApplicantDetails & { profileUpdated: boolean } }) => {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/internships/${id}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter: payload?.coverLetter ?? "",
          answers: (internship.screeningQuestions ?? []).map((q) => ({ questionId: q._id, answer: payload?.answers[q._id] })),
          ...(payload ? { applicant: payload.applicant } : {}),
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
    const target = onPlatform ? undefined : safeHref(internship.applyLink, { mailto: true });
    if (target) {
      // mailto: (Telegram email-apply posts) opens the mail client instead of a new tab
      if (target.startsWith("mailto:")) window.location.href = target;
      else window.open(target, "_blank", "noopener,noreferrer");
    }
    // Scraped listings only: for iFind posts the server reports application_submitted
    if (!onPlatform) track("apply_click", { internship_id: id });
    void submit();
  };

  return (
    <>
      <Button
        size={size}
        variant={isApplied ? "secondary" : "primary"}
        className={className}
        onClick={click}
        loading={applying && !open}
        title={isApplied ? "View application status" : undefined}
      >
        {isApplied ? "Applied ✓" : onPlatform ? "Apply" : internship.applyLink?.startsWith("mailto:") ? "Apply by email" : internship.source === "web" ? "Apply on company site" : `Apply on ${sourceLabel(internship.source)}`}
      </Button>

      {needsForm && open && student?.data?.user && (
        <ApplicationDialog
          open={open}
          internship={internship}
          user={student.data.user}
          applying={applying}
          error={error}
          onRefreshUser={student.mutate}
          onClose={() => setOpen(false)}
          onSubmit={(payload) => void submit(payload)}
        />
      )}
    </>
  );
}
