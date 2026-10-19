import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { EventsPanel } from "@/components/moderator/EventsPanel";

export default async function EventsPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="events" moderator={session}>
            <EventsPanel />
        </ModeratorShell>
    );
}
