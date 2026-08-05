"use client";

import { useMemo, useState, useEffect } from "react";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { InternshipCard } from "@/components/internships/InternshipCard";
import { FilterPanel } from "@/components/internships/FilterPanel";
import { InternshipDetailModal, MobileInternshipDetail } from "@/components/internships/InternshipDetail";
import { useFilters } from "@/hooks/useFilters";
import { Button } from "@/components/ui/Button";
import { cn, getInternshipId } from "@/lib/utils";
import type { Internship, User } from "@/types";

interface BrowseTabProps {
  internships?: Internship[];
  user?: User;
  mobileFilterOpen?: boolean;
  setMobileFilterOpen?: (open: boolean) => void;
}

export function BrowseTab({
  internships = [],
  user,
  mobileFilterOpen: externalMobileFilterOpen,
  setMobileFilterOpen: externalSetMobileFilterOpen,
}: BrowseTabProps) {
  const [query, setQuery] = useState("");
  const [internalMobileFilterOpen, setInternalMobileFilterOpen] = useState(false);

  const isMobileFilterOpen = externalMobileFilterOpen ?? internalMobileFilterOpen;
  const setMobileFilterOpen = externalSetMobileFilterOpen ?? setInternalMobileFilterOpen;

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);

  // Synchronized state for instant updates when saved or applied
  const [appliedIds, setAppliedIds] = useState<Set<string>>(
    new Set((user?.appliedInternships ?? []).map((item) => String(item.internshipId)))
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set((user?.savedInternships ?? []).map(String))
  );

  useEffect(() => {
    setAppliedIds(new Set((user?.appliedInternships ?? []).map((item) => String(item.internshipId))));
    setSavedIds(new Set((user?.savedInternships ?? []).map(String)));
  }, [user]);

  const {
    filters,
    updateFilter,
    resetFilters,
    toggleLocation,
    togglePerk,
    addSkill,
    removeSkill,
  } = useFilters();

  const activeFilterCount = [
    filters.stipendType !== "any",
    filters.locations.length > 0,
    filters.workFromHome,
    filters.durationMin > 1 || filters.durationMax < 12,
    filters.skills.length > 0,
    filters.perks.length > 0,
  ].filter(Boolean).length;

  const results = useMemo(() => {
    let list = [...internships];

    // Search query filter
    const term = query.trim().toLowerCase();
    if (term) {
      list = list.filter((item) =>
        [item.name, item.company, item.city, ...(item.skills || [])]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(term))
      );
    }

    // Stipend type filter
    if (filters.stipendType !== "any") {
      list = list.filter((item) => item.stipend?.type === filters.stipendType);
    }

    // Stipend range filter (for paid)
    if (filters.stipendType === "paid") {
      if (filters.stipendMin > 0) {
        list = list.filter((item) => (item.stipend?.amount || 0) >= filters.stipendMin);
      }
      if (filters.stipendMax < 100000) {
        list = list.filter((item) => (item.stipend?.amount || 0) <= filters.stipendMax);
      }
    }

    // Work from home / Remote filter
    if (filters.workFromHome) {
      list = list.filter((item) => item.isRemote);
    }

    // Locations filter
    if (filters.locations.length > 0) {
      list = list.filter((item) => {
        const itemLocs = [
          item.city,
          item.state,
          item.country,
          item.isRemote ? "Work from Home" : null,
        ].filter(Boolean).map((s) => String(s).toLowerCase());

        return filters.locations.some((loc) =>
          itemLocs.some((il) => il.includes(loc.toLowerCase()))
        );
      });
    }

    // Duration filter
    list = list.filter((item) => {
      const dur = item.duration?.value || 0;
      if (dur === 0) return true;
      return dur >= filters.durationMin && dur <= filters.durationMax;
    });

    // Skills filter
    if (filters.skills.length > 0) {
      list = list.filter((item) => {
        const itemSkills = (item.skills || []).map((s) => s.toLowerCase());
        return filters.skills.some((sk) => itemSkills.includes(sk.toLowerCase()));
      });
    }

    // Perks filter
    if (filters.perks.length > 0) {
      list = list.filter((item) => {
        const itemPerks = (item.perks || []).map((p) => p.toLowerCase());
        return filters.perks.some((pk) =>
          itemPerks.some((ip) => ip.includes(pk.toLowerCase()))
        );
      });
    }

    // Sorting
    list.sort((a, b) => {
      if (filters.sortBy === "stipend") {
        return (b.stipend?.amount || 0) - (a.stipend?.amount || 0);
      }
      if (filters.sortBy === "deadline") {
        if (!a.deadlineDate) return 1;
        if (!b.deadlineDate) return -1;
        return new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime();
      }
      // default: latest
      return new Date(b.datePublished || b.createdAt).getTime() - new Date(a.datePublished || a.createdAt).getTime();
    });

    return list;
  }, [internships, query, filters]);

  // Reset to page 1 whenever results change (filters/query update)
  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  const totalPages = Math.ceil(results.length / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = useMemo(() => {
    return results.slice(startIndex, startIndex + pageSize);
  }, [results, startIndex, pageSize]);

  const handleApplySuccess = (id: string) => {
    setAppliedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleSaveToggle = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex gap-6">
      {/* Desktop Filter Sidebar - hidden on mobile details view */}
      <aside className={cn("hidden lg:block w-64 shrink-0", selectedInternship && "lg:block")}>
        <div className="sticky top-20">
          <FilterPanel
            filters={filters}
            onUpdate={updateFilter}
            onReset={resetFilters}
            onToggleLocation={toggleLocation}
            onTogglePerk={togglePerk}
            onAddSkill={addSkill}
            onRemoveSkill={removeSkill}
            userSkills={user?.skills ?? []}
          />
        </div>
      </aside>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative z-10 w-80 max-w-[85vw] h-full bg-[var(--surface)] shadow-2xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <span className="font-semibold text-sm text-[var(--text)]">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded-md text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <FilterPanel
              filters={filters}
              onUpdate={updateFilter}
              onReset={resetFilters}
              onToggleLocation={toggleLocation}
              onTogglePerk={togglePerk}
              onAddSkill={addSkill}
              onRemoveSkill={removeSkill}
              userSkills={user?.skills ?? []}
            />
          </div>
        </div>
      )}

      {/* Main Results Column */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Mobile-only Full Page Details View (replacing search & card list, keeping bottom navbar) */}
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

        {/* List View - hidden on mobile when detailed view is open */}
        <div className={cn("space-y-4", selectedInternship && "hidden lg:block")}>
          {/* Search Toolbar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 plasma-card px-3.5 py-2.5">
              <Search className="h-4 w-4 text-[var(--text-3)] shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                placeholder="Search by role, company or skill…"
                className="flex-1 text-sm bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-3)]"
              />
            </div>
          </div>

          {/* Count & Reset */}
          <div className="flex items-center justify-between text-xs text-[var(--text-3)] px-0.5">
            <p>
              {results.length} internships found
              {results.length > 0 && ` (showing ${startIndex + 1}–${Math.min(startIndex + pageSize, results.length)})`}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[var(--primary)] hover:underline font-medium"
              >
                Clear filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Cards Grid */}
          {results.length === 0 ? (
            <div className="plasma-card p-12 text-center space-y-3">
              <Search className="h-10 w-10 text-[var(--text-3)] mx-auto" />
              <p className="text-sm font-medium text-[var(--text-2)]">No internships match your criteria.</p>
              <p className="text-xs text-[var(--text-3)]">Try broadening your search query or clearing some filters.</p>
              <Button variant="outline" size="sm" onClick={() => { resetFilters(); setQuery(""); }}>
                Reset Search & Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedResults.map((internship) => {
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
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>

              <span className="text-xs text-[var(--text-2)] font-medium">
                Page <span className="font-semibold text-[var(--text)]">{page}</span> of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
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
