import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-3)]", className)} />
  );
}

export function InternshipCardSkeleton() {
  return (
    <div className="plasma-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-[var(--radius-sm)] shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-14 rounded" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 flex-1 rounded-[var(--radius-sm)]" />
        <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)]" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
