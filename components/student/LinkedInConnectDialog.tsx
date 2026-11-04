"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useStudent } from "@/components/student/StudentProvider";
import type { User } from "@/types";

/** Last step of connecting LinkedIn to an existing account: explains the email replacement and lets the student cancel. */
export function LinkedInConnectDialog({ user }: { user: User }) {
  const { mutate } = useStudent();
  const [busy, setBusy] = useState(false);
  const p = user.linkedinPending;
  if (!p) return null;

  const send = async (cancel: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/user/linkedin/confirm", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cancel ? { cancel: true } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not finish connecting LinkedIn");
      toast.success(cancel ? "LinkedIn was not connected" : "LinkedIn connected");
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finish connecting LinkedIn");
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => !busy && void send(true)} title="Connect LinkedIn to your account?" size="md">
      <div className="space-y-4 text-sm text-[var(--text-2)]">
        {p.changesEmail ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--danger)] p-3 text-[var(--text)]">
            <p className="font-semibold text-[var(--danger)]">Your sign-in email will change</p>
            <p className="mt-1 text-xs">Old: <strong>{p.currentEmail}</strong> (stops working for sign-in and emails)</p>
            <p className="text-xs">New: <strong>{p.email}</strong> (from LinkedIn)</p>
            <p className="mt-2 text-xs">From now on, sign in with LinkedIn, or with the new email and your password. The old email will be useless.</p>
          </div>
        ) : (
          <p>LinkedIn shares the same email as your account (<strong className="text-[var(--text)]">{p.currentEmail}</strong>), so your sign-in email stays the same.</p>
        )}
        <p className="text-xs">{p.emailVerified ? "LinkedIn has verified this email." : "LinkedIn has not verified this email."} The email shown to recruiters on your profile and resume is separate and is not changed.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void send(true)}>Cancel</Button>
          <Button size="sm" loading={busy} onClick={() => void send(false)}>Connect LinkedIn</Button>
        </div>
      </div>
    </Modal>
  );
}
