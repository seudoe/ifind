"use client";

import { useState } from "react";
import { BadgeCheck, Eye, EyeOff, KeyRound, Link2, Link2Off, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { hasBothMethods, linkedinReauthDueAt, linkedinState, LINKEDIN_REAUTH_DAYS, merged, type LinkedInState } from "@/lib/linkedinState";
import type { User as StudentUser } from "@/types";

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="plasma-card p-5">
      <div className="flex items-center gap-2 mb-1 pb-3 border-b border-[var(--border)]">
        <span className="text-[var(--primary)]">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-[var(--heading)]">{title}</h3>
          <p className="text-xs text-[var(--text-3)]">{desc}</p>
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}

const STATES: { key: LinkedInState; title: string; text: string; icon: typeof Link2Off }[] = [
  { key: "normal", title: "Normal", text: "Email and password. Nothing about you has been checked by iFind or LinkedIn.", icon: Link2Off },
  { key: "connected", title: "LinkedIn connected", text: merged ? "Your LinkedIn account is linked to your iFind account." : "Your LinkedIn account is linked, but LinkedIn has not verified your identity (government ID and selfie).", icon: Link2 },
  { key: "verified", title: "Verified on LinkedIn", text: "Your LinkedIn account is linked and LinkedIn has verified your identity (government ID and selfie). Re-checked on every LinkedIn sign-in.", icon: BadgeCheck },
];

const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** The three account states and how this account can sign in. */
export function AccountStatesCard({ user }: { user: StudentUser }) {
  const state = linkedinState(user);
  const both = hasBothMethods(user);
  const due = linkedinReauthDueAt(user);
  return (
    <Card icon={<ShieldCheck className="h-4 w-4" />} title="Account status" desc="How your account is verified and how you can sign in">
      <div className={`grid gap-2 ${merged ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {STATES.filter((s) => !merged || s.key !== "verified").map(({ key, title, text, icon: Icon }) => {
          const on = key === state;
          return (
            <div key={key} className={`rounded-[var(--radius-sm)] border p-3 text-xs ${on ? "border-[var(--primary)] bg-[var(--primary-bg)]" : "border-[var(--border)] opacity-60"}`}>
              <p className="flex items-center gap-1.5 font-semibold text-[var(--heading)]"><Icon className="h-3.5 w-3.5" /> {title}{on && <span className="ml-auto text-[10px] font-bold uppercase text-[var(--primary)]">You</span>}</p>
              <p className="mt-1 text-[var(--text-2)]">{text}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2 text-xs text-[var(--text-2)]">
        <p><strong className="text-[var(--text)]">Sign-in methods:</strong> {[user.hasPassword && "email and password", user.linkedinId && "LinkedIn"].filter(Boolean).join(" and ") || "none"}.</p>
        {both && (
          <p className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3">
            You can sign in with your password or with LinkedIn. About every {LINKEDIN_REAUTH_DAYS} days you must sign in with LinkedIn once so we know it is still you; until then the password keeps working
            {due ? <>{" "}(next LinkedIn sign-in due by <strong className="text-[var(--text)]">{fmt(due)}</strong>)</> : null}. After that date the password stops working until you sign in with LinkedIn.
          </p>
        )}
        {!user.linkedinId && <a href="/api/auth/linkedin?as=student-link" className="inline-block font-medium text-[var(--primary)] hover:underline">Connect LinkedIn</a>}
      </div>
    </Card>
  );
}

/** Change the password, or (LinkedIn-only accounts) set a first one after confirming with LinkedIn again. */
export function PasswordCard({ user }: { user: StudentUser }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const hasPassword = Boolean(user.hasPassword) || done;
  // Back from the LinkedIn confirmation (?pw=ready); the server checks the one-time proof itself
  const [ready, setReady] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pw") === "ready");

  const submit = async () => {
    if (next !== again) return toast.error("The two new passwords do not match");
    setBusy(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === "linkedin_reauth_required") setReady(false);
        throw new Error(json.error || "Could not update the password");
      }
      toast.success(hasPassword ? "Password updated" : "Password set. You can now sign in with it too.");
      setDone(true); setReady(false); setCurrent(""); setNext(""); setAgain("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  };

  const eye = (shown: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} className="text-[var(--text-3)] hover:text-[var(--text)]">{shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
  );

  if (!hasPassword && !ready) {
    return (
      <Card icon={<Lock className="h-4 w-4" />} title="Password" desc="You signed up with LinkedIn">
        <p className="text-sm text-[var(--text-2)]">You registered through LinkedIn, so your account has no password yet. You can add one to sign in with email and password as well.</p>
        <p className="mt-2 text-xs text-[var(--text-3)]">To make sure it is really you, LinkedIn will ask you to sign in again before you can set it.</p>
        <a href="/api/auth/linkedin?as=student-setpw" className="mt-4 inline-flex"><Button size="sm" type="button"><KeyRound className="h-3.5 w-3.5" /> Set password</Button></a>
      </Card>
    );
  }

  return (
    <Card icon={<Lock className="h-4 w-4" />} title={hasPassword ? "Change Password" : "Set Password"} desc={hasPassword ? "Choose a strong password you don't use elsewhere" : "LinkedIn confirmed. Choose a strong password you don't use elsewhere"}>
      <div className="space-y-4">
        {hasPassword && <Input label="Current Password" type={showCurrent ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Your current password" autoComplete="current-password" rightIcon={eye(showCurrent, () => setShowCurrent(!showCurrent))} />}
        <Input label="New Password" type={showNew ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" autoComplete="new-password" rightIcon={eye(showNew, () => setShowNew(!showNew))} />
        <Input label="Confirm New Password" type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
        <Button size="sm" onClick={submit} loading={busy} disabled={!next || (hasPassword && !current)}>{hasPassword ? "Update Password" : "Set Password"}</Button>
        {user.linkedinId && hasPassword && <p className="text-xs text-[var(--text-3)]">You can sign in with this password or with LinkedIn. Other devices are signed out when it changes.</p>}
      </div>
    </Card>
  );
}
