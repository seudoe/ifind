"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom call-to-action for phones, on public pages only. It stays out of the way: hidden above the fold
 * (the hero already has a CTA), hidden again near the page bottom so it never covers the footer, and never
 * shown at sm+ widths. Respects the iOS safe area.
 */
export function StickyMobileCta({ href, label }: { href: string; label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const { scrollY, innerHeight } = window;
      const nearBottom = scrollY + innerHeight > document.documentElement.scrollHeight - 360;
      setVisible(scrollY > 480 && !nearBottom);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 pt-3 backdrop-blur",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 motion-reduce:transition-none",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <Link
        href={href}
        tabIndex={visible ? 0 : -1}
        className="flex w-full items-center justify-center rounded-[var(--radius-sm)] bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white hover:bg-[var(--primary-dk)] transition-colors"
      >
        {label}
      </Link>
    </div>
  );
}
