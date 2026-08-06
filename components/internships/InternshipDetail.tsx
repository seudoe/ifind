"use client";

import { useState } from "react";
import {
  MapPin, Clock, IndianRupee, Calendar, Users,
  ExternalLink, CheckCircle, Wifi, Building2,
  ArrowLeft, Bookmark, BookmarkCheck, Sparkles, X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Internship } from "@/types";
import { formatStipend, formatDuration, formatDate, cn, getInternshipId } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  internship: Internship;
  isApplied: boolean;
  isSaved: boolean;
  onClose: () => void;
  onApplySuccess: () => void;
  onSaveToggle?: (id: string) => void;
}

export function InternshipDetailModal({
  internship,
  open,
  onClose,
  isApplied,
  isSaved,
  onApplySuccess,
  onSaveToggle,
}: Props & { open: boolean }) {
  const [applying, setApplying] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const internshipId = getInternshipId(internship);

  const handleApply = async () => {
    if (isApplied) return;
    
    // Open link synchronously to bypass browser popup blockers
    if (internship.applyLink) {
      window.open(internship.applyLink, "_blank");
    }

    setApplying(true);
    try {
      const res = await fetch(`/api/internships/${internshipId}/apply`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Application recorded!");
      onApplySuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/internships/${internshipId}/save`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onSaveToggle?.(internshipId);
      toast.success(next ? "Saved to bookmarks" : "Removed from bookmarks");
    } catch {
      setSaved(!next);
      toast.error("Failed to update bookmark");
    }
  };

  if (!open) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .internship-detail-popup {
          position: fixed;
          z-index: 50;
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        @media (min-width: 1024px) {
          .internship-detail-popup {
            left: 50%;
            top: 50%;
            height: 85vh;
            width: 520px;
            border-radius: var(--radius);
            animation: slideToCenter 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
        @media (max-width: 1023px) {
          .internship-detail-popup {
            left: 0;
            right: 0;
            top: 0;
            bottom: 49px;
            animation: slideUpMobile 300ms ease-out forwards;
          }
        }
        @keyframes slideToCenter {
          from {
            transform: translate3d(100vw, -50%, 0);
            opacity: 0;
          }
          to {
            transform: translate3d(-50%, -50%, 0);
            opacity: 1;
          }
        }
        @keyframes slideUpMobile {
          from {
            transform: translate3d(0, 100%, 0);
          }
          to {
            transform: translate3d(0, 0, 0);
          }
        }
      `}} />
      
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Center Details Panel */}
      <div className="internship-detail-popup">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">Internship Details</h3>
            <p className="text-[10px] text-[var(--text-3)]">{internship.company}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <InternshipDetailContent internship={internship} />
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center gap-3 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="px-4">
            Back
          </Button>

          <button
            type="button"
            onClick={handleSave}
            className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors shrink-0"
            aria-label={saved ? "Unsave internship" : "Save internship"}
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 text-[var(--primary)]" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>

          <Button
            size="sm"
            variant={isApplied ? "secondary" : "primary"}
            className="flex-1 font-semibold"
            onClick={handleApply}
            loading={applying}
            disabled={isApplied}
          >
            {isApplied ? "Applied ✓" : "Apply Now"}
          </Button>

          <a
            href={internship.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Original Link
            </Button>
          </a>
        </div>
      </div>
    </>
  );
}

export function MobileInternshipDetail({
  internship,
  isApplied,
  isSaved,
  onClose,
  onApplySuccess,
  onSaveToggle,
}: Props) {
  const [applying, setApplying] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const internshipId = getInternshipId(internship);

  const handleApply = async () => {
    if (isApplied) return;

    // Open link synchronously to bypass browser popup blockers
    if (internship.applyLink) {
      window.open(internship.applyLink, "_blank");
    }

    setApplying(true);
    try {
      const res = await fetch(`/api/internships/${internshipId}/apply`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Application recorded!");
      onApplySuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/internships/${internshipId}/save`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onSaveToggle?.(internshipId);
      toast.success(next ? "Saved to bookmarks" : "Removed from bookmarks");
    } catch {
      setSaved(!next);
      toast.error("Failed to update bookmark");
    }
  };

  return (
    <div className="plasma-card bg-[var(--surface)] p-5 space-y-6 w-full animate-in fade-in duration-200">
      {/* Mobile Back Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to list</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--primary)]"
        >
          {saved ? (
            <BookmarkCheck className="h-4.5 w-4.5 text-[var(--primary)]" />
          ) : (
            <Bookmark className="h-4.5 w-4.5" />
          )}
        </button>
      </div>

      <InternshipDetailContent internship={internship} />

      {/* Sticky-like bottom action panel within view */}
      <div className="flex items-center gap-2.5 pt-4 border-t border-[var(--border)]">
        <Button variant="secondary" size="md" onClick={onClose} className="flex-1">
          Back
        </Button>
        <Button
          size="md"
          variant={isApplied ? "secondary" : "primary"}
          className="flex-[2] font-semibold"
          onClick={handleApply}
          loading={applying}
          disabled={isApplied}
        >
          {isApplied ? "Applied ✓" : "Apply Now"}
        </Button>
        <a
          href={internship.applyLink}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--primary)] transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function InternshipDetailContent({ internship }: { internship: Internship }) {
  const location = internship.isRemote
    ? "Work from Home"
    : [internship.city, internship.state, internship.country].filter(Boolean).join(", ") || "India";

  const deadlineSoon =
    internship.deadlineDate &&
    new Date(internship.deadlineDate).getTime() - Date.now() < 7 * 86400000;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-xl font-bold text-[var(--text-2)] shrink-0">
          {internship.company[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-[var(--text)] leading-snug">{internship.name}</h2>
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-2)] font-medium">
              <Building2 className="h-4 w-4 text-[var(--text-3)]" />
              <span>{internship.company}</span>
            </div>
            {internship.datePublished && (
              <span className="text-[10px] text-[var(--text-3)]">
                Posted: {formatDate(internship.datePublished)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {internship.isRemote && (
              <Badge variant="success" className="gap-1 text-[10px]">
                <Wifi className="h-3 w-3" /> Remote
              </Badge>
            )}
            {internship.stipend?.type === "paid" && (
              <Badge variant="default" className="gap-1 text-[10px]">
                <IndianRupee className="h-3 w-3" /> Paid
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Meta Quick Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<IndianRupee className="h-4 w-4 text-green-500" />}
          label="Stipend"
          value={formatStipend(internship.stipend)}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="Duration"
          value={formatDuration(internship.duration)}
        />
        <StatCard
          icon={<MapPin className="h-4 w-4 text-purple-500" />}
          label="Location"
          value={location}
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-orange-500" />}
          label="Openings"
          value={internship.openings ? `${internship.openings} positions` : "N/A"}
        />
      </div>

      {/* Deadline warning banner */}
      {internship.deadlineDate && (
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-[var(--radius-sm)] border text-xs leading-relaxed",
            deadlineSoon
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          )}
        >
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            <strong>Application Deadline:</strong> {formatDate(internship.deadlineDate)}
            {deadlineSoon && " (Closing soon!)"}
          </span>
        </div>
      )}

      {/* Summary */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">
          About the Internship
        </h3>
        <p className="text-sm text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">
          {internship.summary}
        </p>
      </div>

      {/* Responsibilities */}
      {internship.responsibilities && internship.responsibilities.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">
            Key Responsibilities
          </h3>
          <ul className="space-y-2">
            {internship.responsibilities.map((resp, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-2)]">
                <CheckCircle className="h-4 w-4 text-[var(--primary)] shrink-0 mt-0.5" />
                <span>{resp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skills Required */}
      {internship.skills && internship.skills.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">
            Skills Required
          </h3>
          <div className="flex flex-wrap gap-2">
            {internship.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="px-2.5 py-1 text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Eligibility Requirements */}
      {((internship.degree && internship.degree.length > 0) ||
        (internship.field && internship.field.length > 0) ||
        internship.experienceRequired) && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">
            Eligibility & Requirements
          </h3>
          <div className="bg-[var(--surface-2)] rounded-[var(--radius-sm)] p-3.5 space-y-2.5 border border-[var(--border)] text-xs text-[var(--text-2)]">
            {internship.degree && internship.degree.length > 0 && (
              <p>
                <strong>Degrees:</strong> {internship.degree.join(", ")}
              </p>
            )}
            {internship.field && internship.field.length > 0 && (
              <p>
                <strong>Fields of Study:</strong> {internship.field.join(", ")}
              </p>
            )}
            {internship.experienceRequired && (
              <p>
                <strong>Required Experience:</strong>{" "}
                {internship.experienceRequired.min !== undefined
                  ? `${internship.experienceRequired.min} to `
                  : ""}
                {internship.experienceRequired.max !== undefined
                  ? `${internship.experienceRequired.max} `
                  : ""}
                {internship.experienceRequired.unit}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Perks */}
      {internship.perks && internship.perks.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">
            Perks & Benefits
          </h3>
          <div className="flex flex-wrap gap-2">
            {internship.perks.map((perk) => (
              <Badge key={perk} variant="outline" className="px-2.5 py-1 text-xs">
                {perk}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {(internship.source || (internship.tags && internship.tags.length > 0)) && (
        <div className="border-t border-[var(--border)] pt-4 mt-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-3)]">
          {internship.source && (
            <span>
              <strong>Source:</strong> {internship.source}
            </span>
          )}
          {internship.tags && internship.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {internship.tags.map((tag) => (
                <span key={tag} className="bg-[var(--surface-2)] border border-[var(--border)] px-2 py-0.5 rounded-full text-[10px]">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-sm)] p-3 text-center sm:text-left">
      <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <p className="text-xs font-bold text-[var(--text)] truncate">{value}</p>
    </div>
  );
}
