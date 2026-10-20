"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const QUICK_LINKS = [
  ["preferences", "Preference"], ["education", "Education"], ["skills", "Key skills"],
  ["languages", "Languages"], ["internships", "Internships"], ["projects", "Projects"],
  ["summary", "Profile summary"], ["accomplishments", "Accomplishments"],
  ["employment", "Employment"], ["resume", "Resume"],
] as const;

/** Section anchor list that highlights the section currently in view (scroll spy). */
export function QuickLinks() {
  const [active, setActive] = useState<string>(QUICK_LINKS[0][0]);

  useEffect(() => {
    const sections = QUICK_LINKS
      .map(([id]) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!sections.length) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Topmost visible section wins, in page order
        const current = sections.find((el) => visible.has(el.id));
        if (current) setActive(current.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="grid grid-cols-2 gap-x-3 gap-y-1 lg:block">
      {QUICK_LINKS.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "true" : undefined}
          className={cn(
            "block rounded-[var(--radius-sm)] px-2 py-1.5 text-xs transition-colors hover:bg-[var(--primary-bg)] hover:text-[var(--primary)]",
            active === id ? "bg-[var(--primary-bg)] font-semibold text-[var(--primary)]" : "text-[var(--text-2)]",
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
