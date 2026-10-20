"use client";

import { useState } from "react";
import {
  MapPin, Clock, Bookmark, BookmarkCheck,
  Wifi, Sparkles,
} from "lucide-react";
import { Badge }   from "@/components/ui/Badge";
import { ApplyButton } from "@/components/internships/ApplyButton";
import { CompanyLogo } from "@/components/internships/CompanyLogo";
import { StipendBadge } from "@/components/internships/StipendBadge";
import { sourceLabel } from "@/lib/constants";
import { formatAddresses } from "@/lib/address";
import { cn, formatDuration, formatDate, getInternshipId } from "@/lib/utils";
import { toast }   from "sonner";
import type { Internship } from "@/types";

interface Props {
  internship:      Internship;
  view?:           "grid" | "list";
  isSaved?:        boolean;
  isApplied?:      boolean;
  isRecommended?:  boolean;
  onClick?:        () => void;
  onSave?:         (id: string) => void;
  onApply?:        (id: string) => void;
}

export function InternshipCard({
  internship,
  view = "grid",
  isSaved = false,
  isApplied = false,
  isRecommended = false,
  onClick,
  onSave,
  onApply,
}: Props) {
  const [saved,    setSaved]    = useState(isSaved);
  const internshipId = getInternshipId(internship);

  const location = internship.isRemote
    ? "Work from Home"
    : formatAddresses(internship.address, ["city", "state"]) || formatAddresses(internship.address, ["country"]) || "India";

  const deadlineSoon =
    internship.deadlineDate &&
    new Date(internship.deadlineDate).getTime() - Date.now() < 7 * 86400000;

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/internships/${internshipId}/save`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onSave?.(internshipId);
      toast.success(next ? "Saved" : "Removed from saved");
    } catch {
      setSaved(!next);
      toast.error("Failed to save");
    }
  };

  if (view === "list") {
    return (
      <div
        onClick={onClick}
        className="plasma-card flex items-center gap-4 p-4 cursor-pointer hover:-translate-y-px group"
      >
        {/* Logo */}
        <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-base font-bold text-[var(--text-2)] shrink-0 group-hover:border-[var(--primary)] transition-colors">
          <CompanyLogo internship={internship} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                {internship.name}
              </h3>
              <p className="text-sm text-[var(--text-3)]">{internship.company} · via {sourceLabel(internship.source)}</p>
            </div>
            {isRecommended && (
              <Badge variant="default" className="shrink-0 gap-1 text-xs">
                <Sparkles className="h-2.5 w-2.5" /> AI Pick
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-[13px] text-[var(--text-2)]">
            <span className="flex items-center gap-1">
              {internship.isRemote ? <Wifi className="h-3 w-3 text-green-500" /> : <MapPin className="h-3 w-3" />}
              {location}
            </span>
            <StipendBadge stipend={internship.stipend} />
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(internship.duration)}</span>
          </div>
        </div>

        {/* Skills */}
        <div className="hidden lg:flex flex-wrap gap-1 max-w-[180px]">
          {internship.skills.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
        </div>

        {/* Deadline */}
        {internship.deadlineDate && (
          <div className="hidden md:block text-[13px] text-right shrink-0">
            <span className={cn(deadlineSoon ? "text-[var(--danger)] font-medium" : "text-[var(--text-3)]")}>
              {deadlineSoon ? "⚡ " : ""}Closes {formatDate(internship.deadlineDate)}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSave}
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-3)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors"
          >
            {saved ? <BookmarkCheck className="h-4 w-4 text-[var(--primary)]" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <ApplyButton internship={internship} isApplied={isApplied} onApplied={(id) => onApply?.(id)} />
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={onClick}
      className="plasma-card relative flex flex-col h-full cursor-pointer group overflow-hidden hover:-translate-y-0.5 hover:border-[var(--primary)]"
    >
      {/* Accent hairline that lights up on hover */}
      <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--primary)] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-base font-bold text-[var(--text-2)] shrink-0 group-hover:border-[var(--primary)] transition-colors">
              <CompanyLogo internship={internship} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-2 leading-snug">
                {internship.name}
              </h3>
              <p className="text-sm text-[var(--text-3)] mt-0.5">{internship.company} · via {sourceLabel(internship.source)}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="p-1 rounded text-[var(--text-3)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors shrink-0"
          >
            {saved ? <BookmarkCheck className="h-3.5 w-3.5 text-[var(--primary)]" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {internship.isRemote && (
            <Badge variant="success" className="gap-1 text-xs"><Wifi className="h-2.5 w-2.5" />Remote</Badge>
          )}
          {isRecommended && (
            <Badge variant="default" className="gap-1 text-xs"><Sparkles className="h-2.5 w-2.5" />AI Pick</Badge>
          )}
          {deadlineSoon && (
            <Badge variant="warning" className="text-xs">⚡ Closing soon</Badge>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 text-[13px] text-[var(--text-2)]">
          <div className="flex items-center gap-1.5">
            {internship.isRemote ? <Wifi className="h-3 w-3 text-green-500 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
            <span className="truncate">{location}</span>
          </div>
          <StipendBadge stipend={internship.stipend} />
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatDuration(internship.duration)}</span>
          </div>
        </div>

        {/* Skills pinned to the bottom so cards with 3 vs 5 skills line up */}
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {internship.skills.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
          {internship.skills.length > 3 && (
            <Badge variant="outline" className="text-xs">+{internship.skills.length - 3}</Badge>
          )}
        </div>

        {internship.deadlineDate && (
          <p className={cn("text-[13px]", deadlineSoon ? "text-[var(--danger)] font-medium" : "text-[var(--text-3)]")}>
            Deadline: {formatDate(internship.deadlineDate)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
        <ApplyButton internship={internship} isApplied={isApplied} onApplied={(id) => onApply?.(id)} size="md" className="w-full" />
      </div>
    </div>
  );
}
