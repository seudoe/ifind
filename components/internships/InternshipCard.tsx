"use client";

import { useState } from "react";
import {
  MapPin, Clock, IndianRupee, Bookmark, BookmarkCheck,
  ExternalLink, Wifi, Sparkles,
} from "lucide-react";
import { Badge }   from "@/components/ui/Badge";
import { Button }  from "@/components/ui/Button";
import { cn, formatStipend, formatDuration, formatDate } from "@/lib/utils";
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
}

export function InternshipCard({
  internship,
  view = "grid",
  isSaved = false,
  isApplied = false,
  isRecommended = false,
  onClick,
  onSave,
}: Props) {
  const [saved,    setSaved]    = useState(isSaved);
  const [applying, setApplying] = useState(false);

  const location = internship.isRemote
    ? "Work from Home"
    : [internship.city, internship.state].filter(Boolean).join(", ") || internship.country || "India";

  const deadlineSoon =
    internship.deadlineDate &&
    new Date(internship.deadlineDate).getTime() - Date.now() < 7 * 86400000;

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/internships/${internship._id}/save`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onSave?.(internship._id);
      toast.success(next ? "Saved" : "Removed from saved");
    } catch {
      setSaved(!next);
      toast.error("Failed to save");
    }
  };

  const handleApply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isApplied) return;
    setApplying(true);
    try {
      const res  = await fetch(`/api/internships/${internship._id}/apply`, { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Application submitted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
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
          {internship.company[0]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                {internship.name}
              </h3>
              <p className="text-xs text-[var(--text-3)]">{internship.company}</p>
            </div>
            {isRecommended && (
              <Badge variant="default" className="shrink-0 gap-1 text-[10px]">
                <Sparkles className="h-2.5 w-2.5" /> AI Pick
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-[var(--text-2)]">
            <span className="flex items-center gap-1">
              {internship.isRemote ? <Wifi className="h-3 w-3 text-green-500" /> : <MapPin className="h-3 w-3" />}
              {location}
            </span>
            <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />{formatStipend(internship.stipend)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(internship.duration)}</span>
          </div>
        </div>

        {/* Skills */}
        <div className="hidden lg:flex flex-wrap gap-1 max-w-[180px]">
          {internship.skills.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
          ))}
        </div>

        {/* Deadline */}
        {internship.deadlineDate && (
          <div className="hidden md:block text-[11px] text-right shrink-0">
            <span className={cn(deadlineSoon ? "text-red-500 font-medium" : "text-[var(--text-3)]")}>
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
          <Button size="sm" variant={isApplied ? "secondary" : "primary"} onClick={handleApply} loading={applying} disabled={isApplied}>
            {isApplied ? "Applied" : "Apply"}
          </Button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={onClick}
      className="plasma-card flex flex-col cursor-pointer group hover:-translate-y-0.5"
    >
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="h-10 w-10 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-sm font-bold text-[var(--text-2)] shrink-0 group-hover:border-[var(--primary)] transition-colors">
              {internship.company[0]}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-2 leading-snug">
                {internship.name}
              </h3>
              <p className="text-xs text-[var(--text-3)] mt-0.5">{internship.company}</p>
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
            <Badge variant="success" className="gap-1 text-[10px]"><Wifi className="h-2.5 w-2.5" />Remote</Badge>
          )}
          {isRecommended && (
            <Badge variant="default" className="gap-1 text-[10px]"><Sparkles className="h-2.5 w-2.5" />AI Pick</Badge>
          )}
          {deadlineSoon && (
            <Badge variant="warning" className="text-[10px]">⚡ Closing soon</Badge>
          )}
        </div>

        {/* Meta */}
        <div className="space-y-1 text-[11px] text-[var(--text-2)]">
          <div className="flex items-center gap-1.5">
            {internship.isRemote ? <Wifi className="h-3 w-3 text-green-500 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
            <span className="truncate">{location}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <IndianRupee className="h-3 w-3 shrink-0" />
            <span>{formatStipend(internship.stipend)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatDuration(internship.duration)}</span>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1">
          {internship.skills.slice(0, 3).map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
          ))}
          {internship.skills.length > 3 && (
            <Badge variant="outline" className="text-[10px]">+{internship.skills.length - 3}</Badge>
          )}
        </div>

        {internship.deadlineDate && (
          <p className={cn("text-[11px] mt-auto", deadlineSoon ? "text-red-500 font-medium" : "text-[var(--text-3)]")}>
            Deadline: {formatDate(internship.deadlineDate)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2 border-t border-[var(--border)] pt-3">
        <Button
          size="sm"
          variant={isApplied ? "secondary" : "primary"}
          className="flex-1"
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
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-3)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
