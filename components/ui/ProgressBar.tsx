import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
  color?: "primary" | "green" | "amber" | "red";
}

const colorMap: Record<string, string> = {
  primary: "bg-[var(--primary)]",
  green:   "bg-green-500",
  amber:   "bg-amber-500",
  red:     "bg-red-500",
};

export function ProgressBar({ value, className, showLabel = false, color = "primary" }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", colorMap[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-[var(--text-2)] w-9 text-right">{pct}%</span>
      )}
    </div>
  );
}
