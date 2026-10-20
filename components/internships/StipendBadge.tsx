import { Banknote, IndianRupee } from "lucide-react";
import { cn, formatStipend } from "@/lib/utils";
import type { Stipend } from "@/types";

/** Paid stipends get the bright green pill; everything else stays plain text. */
export function StipendBadge({ stipend, className }: { stipend: Stipend; className?: string }) {
  const text = formatStipend(stipend);
  if (stipend?.type === "paid") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-400 bg-gradient-to-r from-emerald-50 to-emerald-300/60 px-2.5 py-0.5 text-xs font-bold italic text-emerald-800",
          className,
        )}
      >
        {text}
        <Banknote className="h-3.5 w-3.5 shrink-0" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <IndianRupee className="h-3 w-3 shrink-0" />
      {text}
    </span>
  );
}
