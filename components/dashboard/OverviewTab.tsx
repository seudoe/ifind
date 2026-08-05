"use client";

import { Send, Bookmark, TrendingUp, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge }       from "@/components/ui/Badge";
import { getStatusColor } from "@/lib/utils";
import type { User } from "@/types";

// ── Mock — swap for real auth context later ───────────────────────────────
const MOCK_USER: User = {
  _id: "1", name: "Rahul Sharma", username: "rahulsharma", email: "rahul@example.com",
  role: "user", profilePicture: null, phone: null, city: "Bangalore", state: null, country: "India",
  resume: { driveFileId: null, driveViewLink: null, uploadedAt: null },
  appliedInternships: [], savedInternships: [], profileCompletionScore: 35,
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

const CHECKLIST = [
  { key: "photo",     label: "Add profile photo",   done: (u: User) => !!u.profilePicture },
  { key: "resume",    label: "Upload resume",        done: (u: User) => !!u.resume?.driveFileId },
  { key: "parsed",    label: "Extract resume data",  done: (u: User) => !!u.resume?.parsedData },
  { key: "skills",    label: "Resume has skills",    done: (u: User) => (u.resume?.parsedData?.skills?.length ?? 0) >= 3 },
  { key: "education", label: "Resume has education", done: (u: User) => (u.resume?.parsedData?.education?.length ?? 0) > 0 },
  { key: "phone",     label: "Add phone number",     done: (u: User) => !!u.phone },
];

export function OverviewTab({ user = MOCK_USER }: { user?: User }) {
  const shortlisted = user.appliedInternships.filter((a) => a.status === "shortlisted").length;

  return (
    <div className="space-y-6">

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Applied",     value: user.appliedInternships.length, icon: <Send className="h-4 w-4" />,       bg: "bg-blue-50 text-[var(--primary)]" },
          { label: "Saved",       value: user.savedInternships.length,   icon: <Bookmark className="h-4 w-4" />,   bg: "bg-purple-50 text-purple-600" },
          { label: "Shortlisted", value: shortlisted,                     icon: <TrendingUp className="h-4 w-4" />, bg: "bg-green-50 text-green-600" },
          { label: "Profile",     value: `${user.profileCompletionScore}%`, icon: <CheckCircle className="h-4 w-4" />, bg: "bg-amber-50 text-amber-600" },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="plasma-card p-4">
            <div className={`inline-flex p-2 rounded-[var(--radius-sm)] ${bg} mb-3`}>{icon}</div>
            <p className="text-xl font-bold text-[var(--text)]">{value}</p>
            <p className="text-xs text-[var(--text-3)] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Profile completion */}
      <div className="plasma-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">Profile Completion</h2>
          <span className="text-lg font-bold text-[var(--primary)]">{user.profileCompletionScore}%</span>
        </div>
        <ProgressBar value={user.profileCompletionScore} className="mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHECKLIST.map(({ key, label, done }) => {
            const isDone = done(user);
            return (
              <div key={key} className="flex items-center gap-2">
                {isDone
                  ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-[var(--border-2)] shrink-0" />}
                <span className={`text-xs ${isDone ? "text-[var(--text-3)] line-through" : "text-[var(--text)]"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Recommendations placeholder */}
      <div className="plasma-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="text-sm font-semibold text-[var(--text)]">Best Internships For You</h2>
        </div>
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-[var(--border-2)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-2)]">
            {user.resume?.parsedData
              ? "Run the recommender to see AI-matched internships."
              : "Upload and extract your resume to enable AI recommendations."}
          </p>
        </div>
      </div>

      {/* Applications */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Your Applications</h2>
        {user.appliedInternships.length === 0 ? (
          <div className="plasma-card text-center py-10">
            <Send className="h-8 w-8 text-[var(--border-2)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-2)]">No applications yet. Start applying!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {user.appliedInternships.map(({ internshipId, appliedAt, status }) => (
              <div key={internshipId} className="plasma-card flex items-center gap-3 p-3">
                <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-2)] shrink-0">?</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{internshipId}</p>
                  <p className="text-xs text-[var(--text-3)]">
                    {new Date(appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <Badge className={getStatusColor(status)}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
