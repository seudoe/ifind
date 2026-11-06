"use client";

import { useEffect, useState } from "react";
import { BrowseTab } from "@/components/dashboard/BrowseTab";
import { idFromSlug } from "@/lib/slug";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

/** The Browse tab. With a slug (from /browse/<slug>) that internship opens straight away. */
export function BrowseView({ slug }: { slug?: string }) {
  const { data, error } = useStudentDashboard();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileFilterOpen((prev) => !prev);
    window.addEventListener("open-browse-filters", handler);
    window.addEventListener("toggle-browse-filters", handler);
    return () => {
      window.removeEventListener("open-browse-filters", handler);
      window.removeEventListener("toggle-browse-filters", handler);
    };
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-[var(--text-2)]">
        {error ?? "Loading internships…"}
      </main>
    );
  }

  return (
    <BrowseTab
      internships={data.browse}
      user={data.user}
      mobileFilterOpen={mobileFilterOpen}
      setMobileFilterOpen={setMobileFilterOpen}
      openInternshipId={slug ? idFromSlug(slug) : null}
    />
  );
}
