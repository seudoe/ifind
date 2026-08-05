"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Send, Bookmark, TrendingUp, CheckCircle, AlertCircle, Sparkles,
  Briefcase, MapPin, Building, GraduationCap, Trash2, FileText,
  ChevronDown, ChevronUp, Edit3
} from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge }       from "@/components/ui/Badge";
import { Avatar }      from "@/components/ui/Avatar";
import { Button }      from "@/components/ui/Button";
import { InternshipCard } from "@/components/internships/InternshipCard";
import { InternshipDetailModal, MobileInternshipDetail } from "@/components/internships/InternshipDetail";
import { getStatusColor, getInternshipId, formatDate, cn } from "@/lib/utils";
import type { Internship, User } from "@/types";
import { toast } from "sonner";

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

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

export function OverviewTab({ user = MOCK_USER, recommended = [], applications = [] }: { user?: User; recommended?: Internship[]; applications?: Internship[] }) {
  const [skillsCollapsed, setSkillsCollapsed] = useState(true);
  const [deleted, setDeleted] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);

  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set((user?.savedInternships ?? []).map(id => getInternshipId({ _id: id }))));
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => new Set((user?.appliedInternships ?? []).map(item => getInternshipId({ _id: item.internshipId }))));

  const handleSaveToggle = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplySuccess = (id: string) => {
    setAppliedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const shortlisted = user.appliedInternships.filter((a) => a.status === "shortlisted").length;
  const applicationNames = new Map(applications.map((internship) => [getInternshipId(internship), internship.name]));

  // --- Dynamic Talent Card Data Extraction from MongoDB Document ---
  const workHistory = user.resume?.parsedData?.workHistory || [];
  const eduHistory = user.resume?.parsedData?.education || [];

  // 1. Calculate experience
  let experienceText = "Can join immediately";
  if (workHistory.length > 0) {
    let totalMonths = 0;
    workHistory.forEach((job) => {
      if (job.period?.start) {
        const start = new Date(job.period.start);
        const end = job.period.isCurrent || !job.period.end ? new Date() : new Date(job.period.end);
        const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (!isNaN(diffMonths) && diffMonths > 0) {
          totalMonths += diffMonths;
        }
      }
    });
    const totalYears = Math.round(totalMonths / 12);
    experienceText = `${totalYears} year${totalYears === 1 ? "" : "s"} fulltime (Can join immediately)`;
  }

  // 2. Location
  const locationText = [user.city, user.state, user.country].filter(Boolean).join(", ") || "Add location";

  // 3. Unique Companies
  const companiesList = Array.from(new Set(workHistory.map(w => w.company))).slice(0, 3).join(" and ");
  const companiesText = companiesList || "No work history uploaded yet";

  // 4. Unique Institutions
  const eduList = Array.from(new Set(eduHistory.map(e => e.institution))).slice(0, 2).join(" and ");
  const educationText = eduList || "Add education details";

  // 5. Skills list with fallback default items if empty
  const parsedSkills = user.resume?.parsedData?.skills?.flatMap(s => s.tools.map(t => t.name)) || [];
  const userSkills = user.skills || [];
  const skillsToRender = Array.from(new Set([...userSkills, ...parsedSkills]));
  const visibleSkills = skillsCollapsed ? skillsToRender.slice(0, 8) : skillsToRender;

  const handleMockDelete = () => {
    setDeleted(true);
    toast.success("Talent card visibility deactivated");
  };

  const handleMockReset = () => {
    setDeleted(false);
    toast.success("Talent card visibility reactivated");
  };

  return (
    <div className="space-y-6">
      {/* Mobile-only Full Page Details View (replacing overview list, keeping bottom navbar) */}
      {selectedInternship && (
        <div className="lg:hidden w-full">
          <MobileInternshipDetail
            internship={selectedInternship}
            isApplied={appliedIds.has(getInternshipId(selectedInternship))}
            isSaved={savedIds.has(getInternshipId(selectedInternship))}
            onClose={() => setSelectedInternship(null)}
            onApplySuccess={() => handleApplySuccess(getInternshipId(selectedInternship))}
          />
        </div>
      )}

      {/* Main Content - hidden on mobile when detailed view is open */}
      <div className={cn("space-y-6", selectedInternship && "hidden lg:block")}>
        {/* ── Your Talent Card Section ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">Your talent card</h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                Your talent card is visible to employers only when you are <span className="font-semibold text-[var(--text-2)]">actively interviewing</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {deleted ? (
                <Button variant="outline" size="sm" onClick={handleMockReset}>
                  Reactivate card
                </Button>
              ) : (
                <>
                  <Link href={`/user/${user.username}/resume`}>
                    <Button variant="outline" size="sm">
                      Update resume
                    </Button>
                  </Link>
                  <Link href={`/user/${user.username}/profile`}>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Edit3 className="h-3 w-3" />
                      Edit talent card
                    </Button>
                  </Link>
                  <button
                    type="button"
                    onClick={handleMockDelete}
                    className="p-2 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-red-50 hover:border-[var(--danger)] transition-all"
                    title="Hide Talent Card"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {!deleted && (
            <div className="plasma-card p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] space-y-4 transition-all duration-200">
              {/* Header info */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar src={user.profilePicture} name={user.name} size="md" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[var(--text)] text-sm">{user.name}</span>
                      <a
                        href="https://linkedin.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0a66c2] hover:opacity-85"
                      >
                        <LinkedinIcon className="h-4 w-4 fill-current" />
                      </a>
                    </div>

                    {user.resume?.driveViewLink ? (
                      <a
                        href={user.resume.driveViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline mt-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Resume</span>
                      </a>
                    ) : (
                      <Link
                        href={`/user/${user.username}/resume`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline mt-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Resume</span>
                      </Link>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-semibold">
                  Last seen {formatDate(user.updatedAt || user.createdAt)}
                </span>
              </div>

              {/* Grid rows with details */}
              <div className="space-y-2.5 text-xs text-[var(--text-2)] pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-[var(--text-3)] shrink-0" />
                  <span>{experienceText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--text-3)] shrink-0" />
                  <span>{locationText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-[var(--text-3)] shrink-0" />
                  <span className="truncate">{companiesText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-[var(--text-3)] shrink-0" />
                  <span className="truncate">{educationText}</span>
                </div>
              </div>

              {/* Skills tag wrap */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {skillsToRender.length > 0 ? (
                  <>
                    {visibleSkills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="px-2.5 py-1 text-xs">
                        {skill}
                      </Badge>
                    ))}

                    {skillsToRender.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setSkillsCollapsed(!skillsCollapsed)}
                        className="text-xs font-bold text-[var(--primary)] hover:underline ml-1 inline-flex items-center gap-0.5"
                      >
                        {skillsCollapsed ? (
                          <>
                            Expand (+{skillsToRender.length - 8})
                            <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            Collapse
                            <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-3)]">No skills listed yet</span>
                )}
              </div>
            </div>
          )}
        </div>

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

        {/* AI Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">Best Internships For You</h2>
          </div>
          {recommended.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {recommended.map((internship) => {
                const id = getInternshipId(internship);
                return (
                  <InternshipCard
                    key={id}
                    internship={internship}
                    isSaved={savedIds.has(id)}
                    isApplied={appliedIds.has(id)}
                    onClick={() => setSelectedInternship(internship)}
                    onSave={handleSaveToggle}
                    onApply={handleApplySuccess}
                  />
                );
              })}
            </div>
          ) : (
            <div className="plasma-card p-8 text-center">
              <Sparkles className="h-8 w-8 text-[var(--border-2)] mx-auto mb-2" />
              <p className="text-sm text-[var(--text-2)]">
                {user.resume?.parsedData ? "No recommendations are available yet." : "Upload and extract your resume to enable AI recommendations."}
              </p>
            </div>
          )}
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
              {user.appliedInternships.map(({ internshipId, appliedAt, status }) => {
                const cleanId = String(internshipId);
                return (
                  <div key={cleanId} className="plasma-card flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-2)] shrink-0">?</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{applicationNames.get(cleanId) ?? "Internship"}</p>
                      <p className="text-xs text-[var(--text-3)]">
                        {new Date(appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <Badge className={getStatusColor(status)}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Dialog Modal Popup */}
      {selectedInternship && (
        <div className="hidden lg:block">
          <InternshipDetailModal
            internship={selectedInternship}
            open={!!selectedInternship}
            isApplied={appliedIds.has(getInternshipId(selectedInternship))}
            isSaved={savedIds.has(getInternshipId(selectedInternship))}
            onClose={() => setSelectedInternship(null)}
            onApplySuccess={() => handleApplySuccess(getInternshipId(selectedInternship))}
          />
        </div>
      )}
    </div>
  );
}
