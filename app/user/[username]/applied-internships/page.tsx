"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Send } from "lucide-react";
import { ApplicationStatusChip } from "@/components/student/ApplicationStatusChip";
import { CompanyLogo } from "@/components/internships/CompanyLogo";
import { Skeleton } from "@/components/ui/Skeleton";
import { sourceLabel } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { AppliedItem } from "@/types/student-application";

export default function AppliedInternshipsPage() {
  const { username } = useParams<{ username: string }>();
  const [items, setItems] = useState<AppliedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/applications", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => (j.success ? setItems(j.data.items) : setError(j.error)))
      .catch(() => setError("Unable to load applications"));
  }, []);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!items) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!items.length) {
    return (
      <div className="plasma-card p-10 text-center max-w-md mx-auto">
        <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-3"><Send className="h-5 w-5 text-[var(--text-3)]" /></div>
        <p className="text-sm font-medium text-[var(--text)]">No applications yet</p>
        <p className="text-xs text-[var(--text-2)] mt-1">Internships you apply to show up here, with their status.</p>
        <Link href={`/user/${username}/browse`} className="inline-block mt-3 text-sm text-[var(--primary)] hover:underline">Browse internships</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-w-3xl">
      {items.map((a) => (
        <li key={a.internshipId}>
          <Link href={`/user/${username}/applied-internships/${a.internshipId}`} className="plasma-card p-4 flex items-center gap-3 hover:shadow-[var(--shadow-md)] transition-shadow">
            <div className="h-10 w-10 shrink-0 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] text-[var(--primary)] font-semibold flex items-center justify-center">
              <CompanyLogo internship={a.internship} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text)] truncate">{a.internship.name}</p>
              <p className="text-xs text-[var(--text-2)] truncate">{a.internship.company} · Applied {formatDate(a.appliedAt)}</p>
            </div>
            {a.tracked ? <ApplicationStatusChip status={a.status} /> : <span className="text-xs text-[var(--text-3)] shrink-0">on {sourceLabel(a.internship.source)}</span>}
            <ChevronRight className="h-4 w-4 text-[var(--text-3)] shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
