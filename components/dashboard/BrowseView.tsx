"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { BrowseTab }      from "@/components/dashboard/BrowseTab";
import { idFromSlug } from "@/lib/slug";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

/** The Browse tab. With a slug (from /browse/<slug>) that internship opens straight away. */
export function BrowseView({ slug }: { slug?: string }) {
  const { data, error } = useStudentDashboard();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">
        {error ?? "Loading internships…"}
      </main>
    );
  }

  const mobileFilterButton = (
    <button
      type="button"
      onClick={() => setMobileFilterOpen(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--primary-bg)] text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all shadow-xs"
      aria-label="Open Filters"
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      <span>Filters</span>
    </button>
  );

  return (
    <>
      <div className="lg:hidden flex justify-end mb-3">{mobileFilterButton}</div>
      <BrowseTab
        internships={data.browse}
        user={data.user}
        mobileFilterOpen={mobileFilterOpen}
        setMobileFilterOpen={setMobileFilterOpen}
        openInternshipId={slug ? idFromSlug(slug) : null}
      />
    </>
  );
}
