"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { NO_FILTERS, TYPE_LABELS, filterEvents, sortEvents, type EventFilters, type EventItem } from "@/lib/events";
import { EventCard } from "./EventCard";
import { EventDetailModal } from "./EventDetailModal";

const TYPES: EventFilters["type"][] = ["all", "hackathon", "contest", "challenge"];
const MODES: Array<{ value: EventFilters["mode"]; label: string }> = [
  { value: "all", label: "Any mode" },
  { value: "online", label: "Online" },
  { value: "in-person", label: "In person" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary-bg)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </button>
  );
}

export function EventsList() {
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFilters>(NO_FILTERS);
  const [open, setOpen] = useState<EventItem | null>(null);

  useEffect(() => {
    fetch("/api/events", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => (j.success ? setItems(j.data.items) : setError(j.error ?? "Unable to load events")))
      .catch(() => setError("Unable to load events"));
  }, []);

  const shown = useMemo(() => (items ? sortEvents(filterEvents(items, filters)) : []), [items, filters]);
  const filtering = filters.type !== "all" || filters.mode !== "all" || filters.hiringOnly;

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <Chip key={t} active={filters.type === t} onClick={() => setFilters((f) => ({ ...f, type: t }))}>
            {t === "all" ? "All" : TYPE_LABELS[t]}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        {MODES.map((m) => (
          <Chip key={m.value} active={filters.mode === m.value} onClick={() => setFilters((f) => ({ ...f, mode: m.value }))}>
            {m.label}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <Chip active={filters.hiringOnly} onClick={() => setFilters((f) => ({ ...f, hiringOnly: !f.hiringOnly }))}>
          <Briefcase className="h-3 w-3" /> Hiring only
        </Chip>
      </div>

      {!items ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="plasma-card p-10 text-center">
          <Trophy className="mx-auto mb-2 h-9 w-9 text-[var(--text-3)]" />
          <p className="text-sm text-[var(--text-3)]">
            {filtering ? "No events match these filters." : "No open hackathons or contests right now. Check back soon."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => <EventCard key={e.id} event={e} onOpen={setOpen} />)}
        </div>
      )}

      <EventDetailModal event={open} onClose={() => setOpen(null)} />
    </div>
  );
}
