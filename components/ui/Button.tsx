import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-[var(--primary)] text-white border border-[var(--primary)] hover:bg-[var(--primary-dk)] hover:border-[var(--primary-dk)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1",
  secondary:
    "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-3)] hover:border-[var(--border-2)] focus:ring-2 focus:ring-[var(--border-2)]",
  outline:
    "bg-transparent text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary-bg)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1",
  ghost:
    "bg-transparent text-[var(--text-2)] border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:ring-2 focus:ring-[var(--border-2)]",
  danger:
    "bg-[var(--danger)] text-white border border-[var(--danger)] hover:opacity-90 focus:ring-2 focus:ring-[var(--danger)] focus:ring-offset-1",
};

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
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
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium",
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
