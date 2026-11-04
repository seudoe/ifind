"use client";

import { useState } from "react";
import { BadgeCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { useStudent } from "@/components/student/StudentProvider";
import { linkedinTrusted, merged } from "@/lib/linkedinState";
import type { User } from "@/types";

/** Shown once, right after an existing account connects LinkedIn: review what LinkedIn gave us, optionally apply it. */
export function LinkedInReviewDialog({ user }: { user: User }) {
  const { mutate } = useStudent();
  const li = user.linkedinDetails;
  const [name, setName] = useState(li?.name || user.name);
  const [usePhoto, setUsePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  if (!user.linkedinId || !li || !user.linkedinLinkedAt || user.linkedinReviewedAt || closed) return null;

  const done = async (apply: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/user/linkedin/review", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apply ? { name, useLinkedInPhoto: usePhoto } : {}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save");
      setClosed(true);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => !busy && void done(false)} title="LinkedIn connected" description="This is what we received from LinkedIn. You will not be asked again." size="md">
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <Avatar src={li.picture} name={li.name || user.name} size="lg" />
          <label className="flex items-center gap-2 text-xs text-[var(--text-2)]">
            <input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} disabled={!li.picture} />
            Use this as my profile photo
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-[var(--text-2)]">Name (from LinkedIn, editable)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
        </label>
        <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-2)] space-y-1">
          <p>LinkedIn email: <strong className="text-[var(--text)]">{li.email ?? "not shared"}</strong></p>
          <p className="flex items-center gap-1.5">
            {linkedinTrusted(user) ? <><BadgeCheck className="h-4 w-4 text-[#0a66c2]" /> {merged ? "LinkedIn connected" : "Identity verified on LinkedIn"}</> : <><AlertTriangle className="h-4 w-4 text-amber-500" /> Identity not verified on LinkedIn</>}
          </p>
          <p>Your sign-in email is <strong className="text-[var(--text)]">{user.email}</strong>.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void done(false)}>Keep my details</Button>
          <Button size="sm" loading={busy} onClick={() => void done(true)}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
