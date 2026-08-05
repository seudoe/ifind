import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "success" | "warning" | "danger" | "outline";
  className?: string;
}

const variantClasses: Record<string, string> = {
  default:   "bg-[var(--primary-bg)] text-[var(--primary)]",
  secondary: "bg-[var(--surface-2)] text-[var(--text-2)]",
  success:   "bg-green-50 text-green-700",
  warning:   "bg-amber-50 text-amber-700",
  danger:    "bg-red-50 text-red-700",
  outline:   "border border-[var(--border)] text-[var(--text-2)] bg-transparent",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
