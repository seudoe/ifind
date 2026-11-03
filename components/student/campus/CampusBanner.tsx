"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { BANNER_NOT_JOINED, BANNER_NO_ENTITY } from "@/lib/campus/copy";
import type { CampusStateView } from "@/types/campusStudent";

/** Yellow warning shown on every campus sub-tab until the student has joined a campus. */
export function CampusBanner({ banner }: { banner: CampusStateView["banner"] }) {
    const { username } = useParams<{ username: string }>();
    if (banner === "none") return null;
    return (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-[var(--radius)] border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
                {banner === "no_entity" ? BANNER_NO_ENTITY : BANNER_NOT_JOINED}{" "}
                <Link href={`/user/${username}/campus/campuses`} className="font-medium underline">{banner === "no_entity" ? "See what to do" : "Find your campus"}</Link>
            </p>
        </div>
    );
}
