"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System default", icon: Monitor },
];

/** Three-way Light / Dark / System selector. `compact` hides the text labels (icons only). */
export function ThemeSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("grid grid-cols-3 gap-1 p-1 border border-[var(--border)] bg-[var(--surface-2)] rounded-[var(--radius-sm)]", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--radius-sm)] font-mono text-[10px] font-bold uppercase tracking-[0.05em] transition-colors",
              active ? "bg-[var(--primary)] text-white" : "text-[var(--text-2)] hover:bg-[var(--primary-bg)] hover:text-[var(--heading)]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!compact && <span className="truncate">{value === "system" ? "Auto" : label}</span>}
          </button>
        );
      })}
    </div>
  );
}
