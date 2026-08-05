"use client";

import { useState } from "react";
import { Eye, EyeOff, User, Lock, Bell, Trash2 } from "lucide-react";
import { Input }  from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import type { User as StudentUser } from "@/types";

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="plasma-card p-5">
      <div className="flex items-center gap-2 mb-1 pb-3 border-b border-[var(--border)]">
        <span className="text-[var(--primary)]">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          <p className="text-xs text-[var(--text-3)]">{desc}</p>
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function SettingsTab({ user }: { user: StudentUser }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  return (
    <div className="space-y-5 w-full">

      {/* ── Profile info ──────────────────────────────────────────────── */}
      <Section
        icon={<User className="h-4 w-4" />}
        title="Profile Information"
        desc="Update your name, location and contact details"
      >
        <div className="flex items-center gap-4 mb-5">
          <Avatar src={user.profilePicture} name={user.name} size="lg" />
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Profile photo</p>
            <p className="text-xs text-[var(--text-3)] mt-0.5">JPG, PNG or WebP · max 2 MB</p>
            <Button variant="outline" size="sm" className="mt-2">Change Photo</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" defaultValue={user.name} />
          <Input label="Username" defaultValue={user.username} disabled className="opacity-60" />
          <Input label="Email" defaultValue={user.email} type="email" />
          <Input label="Phone" defaultValue={user.phone ?? ""} placeholder="+91 98765 43210" />
          <Input label="City" defaultValue={user.city ?? ""} placeholder="Bangalore" />
          <Input label="Country" defaultValue={user.country ?? ""} placeholder="India" />
        </div>
        <Button className="mt-4" size="sm">Save Changes</Button>
      </Section>

      {/* ── Password ──────────────────────────────────────────────────── */}
      <Section
        icon={<Lock className="h-4 w-4" />}
        title="Change Password"
        desc="Choose a strong password you don't use elsewhere"
      >
        <div className="space-y-4">
          <Input
            label="Current Password"
            type={showCurrent ? "text" : "password"}
            placeholder="Your current password"
            rightIcon={
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="text-[var(--text-3)] hover:text-[var(--text)]">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <Input
            label="New Password"
            type={showNew ? "text" : "password"}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            rightIcon={
              <button type="button" onClick={() => setShowNew(!showNew)} className="text-[var(--text-3)] hover:text-[var(--text)]">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <Input label="Confirm New Password" type="password" placeholder="Repeat new password" />
          <Button size="sm">Update Password</Button>
        </div>
      </Section>

      {/* ── Notifications ─────────────────────────────────────────────── */}
      <Section
        icon={<Bell className="h-4 w-4" />}
        title="Notifications"
        desc="Choose what emails you want to receive"
      >
        <div className="space-y-3">
          {[
            { label: "New matching internships",      sub: "Daily digest of internships that match your profile" },
            { label: "Application status updates",    sub: "When your application status changes" },
            { label: "Deadline reminders",            sub: "48h before a saved internship closes" },
            { label: "Product updates & news",        sub: "Occasional updates about new iFind features" },
          ].map(({ label, sub }) => (
            <label key={label} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                defaultChecked
                className="mt-0.5 accent-[var(--primary)] h-3.5 w-3.5"
              />
              <div>
                <p className="text-sm text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">{label}</p>
                <p className="text-xs text-[var(--text-3)]">{sub}</p>
              </div>
            </label>
          ))}
        </div>
        <Button size="sm" className="mt-4">Save Preferences</Button>
      </Section>

      {/* ── Danger zone ───────────────────────────────────────────────── */}
      <Section
        icon={<Trash2 className="h-4 w-4 text-red-500" />}
        title="Danger Zone"
        desc="Irreversible actions — proceed with caution"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Delete account</p>
            <p className="text-xs text-[var(--text-3)] mt-0.5">
              Permanently removes your profile, resume, and all application data. Cannot be undone.
            </p>
          </div>
          <Button variant="danger" size="sm" className="shrink-0">Delete Account</Button>
        </div>
      </Section>
    </div>
  );
}
