import { cn } from "@/lib/utils";

/**
 * Decorative dot-grid backdrop with a soft Breeze-blue glow, fixed behind page content.
 * Pure CSS (no JS, no canvas) and driven by the design tokens, so it follows the theme.
 * Inspired by the dot-grid backgrounds on 21st.dev; written in-house because that
 * registry requires an API key to download components.
 */
export function DotGridBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("dot-grid-bg pointer-events-none fixed inset-0 z-0", className)} />
  );
}
