import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
    return (
        <main className="flex-1 p-4 md:p-8 max-w-5xl">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
        </main>
    );
}
