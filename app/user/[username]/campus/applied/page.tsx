"use client";

import { Send } from "lucide-react";
import { useCampus } from "@/components/student/campus/CampusProvider";

/** Applied: campus applications. Applying opens with the next release of this feature; nothing can exist here yet. */
export default function CampusAppliedPage() {
    const { state } = useCampus();
    if (!state) return null;
    return (
        <div className="plasma-card p-10 text-center max-w-md mx-auto">
            <Send className="mx-auto mb-3 h-9 w-9 text-[var(--text-3)]" />
            <p className="text-sm font-medium text-[var(--text)]">No campus applications yet</p>
            <p className="mt-1 text-xs text-[var(--text-2)]">{state.current ? "Internships you apply to through your campus show up here with their status." : "Join your college's campus to apply to its internships."}</p>
        </div>
    );
}
