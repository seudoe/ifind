"use client";

import { Briefcase, CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { MODE_LABELS, TYPE_LABELS, closingLabel, eventDates, type EventItem, type Tone } from "@/lib/events";
import { EventBanner } from "./EventBanner";

const TONE_VARIANT: Record<Tone, "danger" | "warning" | "secondary"> = { red: "danger", amber: "warning", neutral: "secondary" };

export function ClosingBadge({ event, className }: { event: Pick<EventItem, "datesKnown" | "expiresAt">; className?: string }) {
  const { text, tone } = closingLabel(event);
  return <Badge variant={TONE_VARIANT[tone]} className={className}>{text}</Badge>;
}

export function EventCard({ event, onOpen }: { event: EventItem; onOpen: (event: EventItem) => void }) {
  const dates = eventDates(event);
  const place = event.mode === "online" ? MODE_LABELS.online : [event.mode ? MODE_LABELS[event.mode] : null, event.location].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className={cn("plasma-card group flex flex-col overflow-hidden text-left p-0", "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]")}
    >
      <div className="relative">
        <EventBanner event={event} className="h-32 w-full" />
        <ClosingBadge event={event} className="absolute right-2 top-2 shadow-sm" />
        {event.hiring && (
          <span className="absolute left-0 top-3 inline-flex items-center gap-1 rounded-r-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            <Briefcase className="h-3 w-3" /> Hiring opportunity
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="default">{TYPE_LABELS[event.type]}</Badge>
          {event.mode && <Badge variant="outline">{MODE_LABELS[event.mode]}</Badge>}
        </div>
        <h3 className="text-sm font-semibold text-[var(--text)] leading-snug line-clamp-2">{event.title}</h3>
        {event.organiser && <p className="text-xs text-[var(--text-2)]">by {event.organiser}</p>}
        {event.summary && <p className="text-xs text-[var(--text-3)] line-clamp-2">{event.summary}</p>}

        <div className="mt-auto space-y-1 pt-1 text-xs text-[var(--text-2)]">
          {dates && (
            <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)]" />{dates}</p>
          )}
          {place && (
            <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)]" />{place}</p>
          )}
        </div>
      </div>
    </button>
  );
}
