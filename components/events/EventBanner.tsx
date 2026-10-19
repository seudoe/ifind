"use client";
/* eslint-disable @next/next/no-img-element -- event images come from arbitrary organiser sites */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EventItem } from "@/lib/events";

const GRADIENTS = [
  "from-indigo-500 to-sky-500",
  "from-fuchsia-500 to-rose-500",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-indigo-600",
  "from-cyan-500 to-blue-600",
];

function gradientFor(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** The page's share image when the event has one and it loads, otherwise a gradient with the organiser's initial. */
export function EventBanner({ event, className }: { event: Pick<EventItem, "title" | "organiser" | "imageUrl">; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!event.imageUrl && failedUrl !== event.imageUrl;
  const label = (event.organiser || event.title).trim();

  return (
    <div className={cn("relative overflow-hidden bg-[var(--surface-3)]", className)}>
      {showImage ? (
        <img
          src={event.imageUrl!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(event.imageUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradientFor(label))}>
          <span className="text-4xl font-bold text-white/90 select-none">{label.charAt(0).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}
