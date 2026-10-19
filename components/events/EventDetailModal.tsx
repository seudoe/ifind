"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Briefcase, CalendarDays, ExternalLink, GraduationCap, Info, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { MODE_LABELS, TYPE_LABELS, eventDates, formatDay, type EventItem } from "@/lib/events";
import { ClosingBadge } from "./EventCard";
import { EventBanner } from "./EventBanner";

function Row({ icon: Icon, label, children }: { icon: typeof Info; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-3)]" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">{label}</p>
        <div className="text-sm text-[var(--text)] break-words">{children}</div>
      </div>
    </div>
  );
}

export function EventDetailModal({ event, onClose }: { event: EventItem | null; onClose: () => void }) {
  const dates = event ? eventDates(event) : "";
  const place = event ? [event.mode ? MODE_LABELS[event.mode] : null, event.location].filter(Boolean).join(" · ") : "";

  return (
    <Modal open={!!event} onClose={onClose} size="lg" className="p-0">
      {event && (
        <div>
          <EventBanner event={event} className="h-44 w-full" />
          <div className="space-y-5 p-6">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="default">{TYPE_LABELS[event.type]}</Badge>
                {event.mode && <Badge variant="outline">{MODE_LABELS[event.mode]}</Badge>}
                <ClosingBadge event={event} />
              </div>
              <Dialog.Title className="text-lg font-bold text-[var(--text)] leading-snug">{event.title}</Dialog.Title>
              {event.organiser && <Dialog.Description className="mt-0.5 text-sm text-[var(--text-2)]">by {event.organiser}</Dialog.Description>}
            </div>

            {event.summary && <p className="text-sm text-[var(--text-2)] whitespace-pre-line">{event.summary}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              {dates && <Row icon={CalendarDays} label="When">{dates}</Row>}
              {event.registrationDeadline && <Row icon={CalendarDays} label="Register by">{formatDay(event.registrationDeadline)}</Row>}
              {place && <Row icon={MapPin} label="Where">{place}</Row>}
              {event.eligibility && <Row icon={GraduationCap} label="Who can join">{event.eligibility}</Row>}
            </div>

            {event.perks.length > 0 && (
              <Row icon={Briefcase} label="What you get">
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {event.perks.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </Row>
            )}

            {event.note && (
              <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]"><Info className="h-3.5 w-3.5" /> Note</p>
                <p className="text-sm text-[var(--text-2)] whitespace-pre-line">{event.note}</p>
              </div>
            )}

            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--primary)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-dk)]"
            >
              Register <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
