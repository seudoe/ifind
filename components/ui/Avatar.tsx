import { useState } from "react";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const initials = getInitials(name);
  const [failed, setFailed] = useState<string | null>(null);

  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        // LinkedIn and other CDNs refuse hot-linked images that carry a Referer; a dead link falls back to initials
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={cn("rounded-[var(--radius-sm)] object-cover shrink-0", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] bg-[var(--navy)] text-white font-bold",
        "flex items-center justify-center shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
