"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { sourceLabel } from "@/lib/constants";
import { getInternshipId } from "@/lib/utils";
import type { Internship } from "@/types";

interface Props {
  internship: Internship;
  isApplied: boolean;
  onApplied: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
}

/** One apply button for card, pop-up and mobile view: "Apply on {Source}" for scraped listings, "Apply" for iFind posts. */
export function ApplyButton({ internship, isApplied, onApplied, size = "sm", className }: Props) {
  const [applying, setApplying] = useState(false);
  const id = getInternshipId(internship);
  const onPlatform = internship.source === "ifind";

  const apply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isApplied) return;
    // Open the source site synchronously to bypass popup blockers
    if (!onPlatform && internship.applyLink) window.open(internship.applyLink, "_blank");

    setApplying(true);
    try {
      const res = await fetch(`/api/internships/${id}/apply`, { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Application recorded!");
      onApplied(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Button
      size={size}
      variant={isApplied ? "secondary" : "primary"}
      className={className}
      onClick={apply}
      loading={applying}
      disabled={isApplied}
    >
      {isApplied ? "Applied ✓" : onPlatform ? "Apply" : `Apply on ${sourceLabel(internship.source)}`}
    </Button>
  );
}
