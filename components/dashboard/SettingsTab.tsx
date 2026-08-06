"use client";

import { useState, useRef } from "react";
import { Eye, EyeOff, User, Lock, Bell, Trash2, Camera, AlertTriangle } from "lucide-react";
import { Input }  from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import type { User as StudentUser } from "@/types";
import { toast } from "sonner";

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

export function SettingsTab({ user }: { user: StudentUser }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  // --- Account Info Form State ---
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [city, setCity] = useState(user.city || "");
  const [country, setCountry] = useState(user.country || "");
  const [dateOfBirth, setDateOfBirth] = useState(
    user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split("T")[0] : ""
  );
  const [profilePicture, setProfilePicture] = useState(user.profilePicture || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);

  // Recruiter-facing name check (from resume metaDetails)
  const recruiterName = user.resume?.parsedData?.metaDetails?.name;
  const hasNameMismatch = Boolean(
    recruiterName &&
    recruiterName.trim() !== "" &&
    recruiterName.trim().toLowerCase() !== name.trim().toLowerCase()
  );

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/user/upload-picture", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Photo upload failed");
      setProfilePicture(json.url);
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Account name cannot be empty.");
      return;
    }
    if (!email.trim()) {
      toast.error("Account email cannot be empty.");
      return;
    }

    setSavingInfo(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userUpdate: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            dateOfBirth: dateOfBirth || null,
            city: city.trim() || null,
            country: country.trim() || null,
            profilePicture: profilePicture || null,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save account settings");
      toast.success("Account settings updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <div className="space-y-5 w-full">

      {/* ── App Account Profile info ────────────────────────────────────────── */}
      <Section
        icon={<User className="h-4 w-4" />}
        title="iFind Account Settings"
        desc="Manage your student account in iFind (app settings)"
      >
        <div className="flex items-center gap-4 mb-5">
          <Avatar src={profilePicture} name={name || user.name} size="lg" />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-[var(--text)]">Account profile photo</p>
            <p className="text-xs text-[var(--text-3)]">JPG, PNG or WebP · max 5 MB</p>
            <div className="flex gap-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5 mr-1" />
                {uploadingPhoto ? "Uploading..." : "Change Photo"}
              </Button>
              {profilePicture && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setProfilePicture("")}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Full Name (Account Name)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {/* Red Warning message if account name is different from recruiter-facing name */}
            {hasNameMismatch && (
              <div className="mt-2 p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-600">Name Mismatch Warning</p>
                  <p className="mt-0.5">
                    Your name for recruiters to see on your resume/profile (<strong className="font-bold underline">{recruiterName}</strong>) is different from your account name in iFind.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Input label="Username" value={user.username} disabled className="opacity-60 cursor-not-allowed" />
          <Input label="App Account Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bangalore" />
          <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="India" />
        </div>
        <Button className="mt-4" size="sm" onClick={handleSaveProfile} loading={savingInfo}>
          Save Changes
        </Button>
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
