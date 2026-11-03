"use client";

import { CalendarDays } from "lucide-react";
import { useCampus } from "@/components/student/campus/CampusProvider";

/** Home: the campus feed. Events and announcements arrive with the events feature; until then this is truthfully empty. */
export default function CampusHomePage() {
    const { state } = useCampus();
    if (!state) return null;
    return (
        <div className="plasma-card p-10 text-center max-w-md mx-auto">
            <CalendarDays className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
            {state.current ? (
                <>
                    <p className="text-sm font-medium text-[var(--text)]">No updates from {state.current.name} yet</p>
                    <p className="mt-1 text-xs text-[var(--text-2)]">Announcements, tests and interview schedules will appear here.</p>
                </>
            ) : (
                <>
                    <p className="text-sm font-medium text-[var(--text)]">Updates from your campus show up here</p>
                    <p className="mt-1 text-xs text-[var(--text-2)]">Join your college&apos;s campus to see its announcements and schedules.</p>
                </>
            )}
        </div>
    );
}
