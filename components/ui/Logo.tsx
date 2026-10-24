import { cn } from "@/lib/utils";

/** Brand lockup: navy badge, "i" in violet, "Find" in white. `suffix` swaps the word (e.g. "Mod"). */
export function Logo({ size = "sm", suffix = "Find", className }: { size?: "sm" | "md" | "lg"; suffix?: string; className?: string }) {
  return (
    <span className={cn("logo-badge", size === "md" && "logo-badge-md", size === "lg" && "logo-badge-lg", className)}>
      <span className="logo-badge-i">i</span>{suffix}
    </span>
  );
}
