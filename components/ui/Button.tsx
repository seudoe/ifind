import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--on-primary)] border border-[var(--primary)] hover:bg-[var(--primary-dk)] hover:border-[var(--primary-dk)]",
  secondary:
    "bg-[var(--surface)] text-[var(--heading)] border border-[var(--border)] hover:bg-[var(--primary-bg)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
  outline:
    "bg-transparent text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary-bg)]",
  ghost:
    "bg-transparent text-[var(--text-2)] border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--heading)]",
  danger:
    "bg-[var(--danger)] text-[var(--on-primary)] border border-[var(--danger)] hover:opacity-90",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-[10.5px]",
  md: "px-4 py-2 text-[11px]",
  lg: "px-5 py-3 text-xs",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, className, children, disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-mono font-bold uppercase tracking-[0.05em]",
        "transition-all duration-[var(--transition)] ease-out",
        "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
