import { cn } from "@/lib/utils";

const H = { sm: 24, md: 32, lg: 44 } as const;

/**
 * Brand logo. Swaps between the light and dark artwork with the app theme (`data-theme`), so it stays legible either way.
 * `onDark` forces the dark artwork for surfaces that are always dark (footer, auth panel).
 * `suffix=""` renders the mark alone (collapsed sidebar); any suffix other than "Find" (e.g. "Mod") adds a small tag beside the logo.
 */
export function Logo({ size = "sm", suffix = "Find", onDark = false, className }: { size?: "sm" | "md" | "lg"; suffix?: string; onDark?: boolean; className?: string }) {
  const h = H[size];
  const markOnly = suffix === "";
  const light = markOnly ? "/logo-mark.svg" : "/logo-clean.svg";
  const dark = markOnly ? "/logo-mark-dark.svg" : "/logo-clean-dark.svg";
  const w = markOnly ? h : Math.round((h * 280) / 72);
  const tag = suffix && suffix !== "Find" ? suffix : null;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt="iFind" width={w} height={h} className={onDark ? "hidden" : "logo-art-light"} style={{ height: h, width: w }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark} alt="" aria-hidden width={w} height={h} className={onDark ? "block" : "logo-art-dark"} style={{ height: h, width: w }} />
      {tag && <span className={cn("rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider", onDark ? "border-white/30 text-white/80" : "border-[var(--border)] text-[var(--text-2)]")}>{tag}</span>}
    </span>
  );
}
