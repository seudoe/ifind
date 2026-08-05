"use client";

import { useState } from "react";
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import type { InternshipFilters } from "@/types";
import { LOCATIONS, PERKS_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  filters: InternshipFilters;
  onUpdate: <K extends keyof InternshipFilters>(key: K, value: InternshipFilters[K]) => void;
  onReset: () => void;
  onToggleLocation: (loc: string) => void;
  onTogglePerk: (perk: string) => void;
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  userSkills?: string[];
}

export function FilterPanel({
  filters,
  onUpdate,
  onReset,
  onToggleLocation,
  onTogglePerk,
  onAddSkill,
  onRemoveSkill,
  userSkills = [],
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState({
    sortBy: true,
    stipend: true,
    location: true,
    duration: true,
    skills: true,
    perks: true,
  });

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const activeCount = [
    filters.stipendType !== "any",
    filters.locations.length > 0,
    filters.workFromHome,
    filters.durationMin > 1 || filters.durationMax < 12,
    filters.skills.length > 0,
    filters.perks.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="plasma-card overflow-hidden bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--primary)]" />
          <span className="font-semibold text-[var(--text)] text-sm">Filters</span>
          {activeCount > 0 && (
            <span className="h-5 w-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-medium">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-[var(--primary)] hover:underline font-medium flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="divide-y divide-[var(--border)]">
        {/* Sort By */}
        <FilterSection
          title="Sort By"
          expanded={expanded.sortBy}
          onToggle={() => toggle("sortBy")}
        >
          <div className="flex flex-col gap-1.5">
            {(["latest", "deadline", "stipend"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer py-0.5 select-none">
                <input
                  type="radio"
                  name="sortBy"
                  value={opt}
                  checked={filters.sortBy === opt}
                  onChange={() => onUpdate("sortBy", opt)}
                  className="accent-[var(--primary)] h-3.5 w-3.5"
                />
                <span className="text-xs text-[var(--text-2)] capitalize">
                  {opt === "latest" ? "Latest First" : opt === "deadline" ? "Deadline" : "Highest Stipend"}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Stipend */}
        <FilterSection
          title="Stipend"
          expanded={expanded.stipend}
          onToggle={() => toggle("stipend")}
        >
          <div className="space-y-2.5">
            {(["any", "paid", "unpaid", "performance-based"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="stipendType"
                  value={opt}
                  checked={filters.stipendType === opt}
                  onChange={() => onUpdate("stipendType", opt)}
                  className="accent-[var(--primary)] h-3.5 w-3.5"
                />
                <span className="text-xs text-[var(--text-2)] capitalize">
                  {opt === "any" ? "Any" : opt === "paid" ? "Paid" : opt === "unpaid" ? "Unpaid" : "Performance Based"}
                </span>
              </label>
            ))}
            {filters.stipendType === "paid" && (
              <div className="pt-2 space-y-2">
                <p className="text-xs text-[var(--text-3)] font-medium">Stipend Range (₹/month)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.stipendMin || ""}
                    onChange={(e) => onUpdate("stipendMin", Number(e.target.value))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                  <span className="text-[var(--text-3)] text-xs">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.stipendMax || ""}
                    onChange={(e) => onUpdate("stipendMax", Number(e.target.value))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>
            )}
          </div>
        </FilterSection>

        {/* Location */}
        <FilterSection
          title="Location"
          expanded={expanded.location}
          onToggle={() => toggle("location")}
        >
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {LOCATIONS.map((loc) => (
              <label key={loc} className="flex items-center gap-2 cursor-pointer py-0.5 select-none">
                <input
                  type="checkbox"
                  checked={filters.locations.includes(loc) || (loc === "Work from Home" && filters.workFromHome)}
                  onChange={() => {
                    if (loc === "Work from Home") {
                      onUpdate("workFromHome", !filters.workFromHome);
                    } else {
                      onToggleLocation(loc);
                    }
                  }}
                  className="accent-[var(--primary)] rounded h-3.5 w-3.5"
                />
                <span className="text-xs text-[var(--text-2)]">{loc}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Duration */}
        <FilterSection
          title="Duration (months)"
          expanded={expanded.duration}
          onToggle={() => toggle("duration")}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={filters.durationMin}
                onChange={(e) => onUpdate("durationMin", Number(e.target.value))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
              <span className="text-[var(--text-3)] text-xs">–</span>
              <input
                type="number"
                min={1}
                max={12}
                value={filters.durationMax}
                onChange={(e) => onUpdate("durationMax", Number(e.target.value))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <p className="text-xs text-[var(--text-3)]">{filters.durationMin} – {filters.durationMax} months</p>
          </div>
        </FilterSection>

        {/* Skills */}
        <FilterSection
          title="Skills"
          expanded={expanded.skills}
          onToggle={() => toggle("skills")}
        >
          <div className="space-y-2">
            <TagInput
              tags={filters.skills}
              onChange={(tags) => onUpdate("skills", tags)}
              placeholder="Add skill..."
            />
            {userSkills.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onUpdate("skills", userSkills)}
              >
                Use My Skills
              </Button>
            )}
          </div>
        </FilterSection>

        {/* Perks */}
        <FilterSection
          title="Perks"
          expanded={expanded.perks}
          onToggle={() => toggle("perks")}
        >
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {PERKS_OPTIONS.map((perk) => (
              <label key={perk} className="flex items-center gap-2 cursor-pointer py-0.5 select-none">
                <input
                  type="checkbox"
                  checked={filters.perks.includes(perk)}
                  onChange={() => onTogglePerk(perk)}
                  className="accent-[var(--primary)] rounded h-3.5 w-3.5"
                />
                <span className="text-xs text-[var(--text-2)]">{perk}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full mb-2 text-left"
      >
        <span className="text-xs font-semibold text-[var(--text)]">{title}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-3)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-3)]" />
        )}
      </button>
      <div className={cn(!expanded && "hidden")}>{children}</div>
    </div>
  );
}
