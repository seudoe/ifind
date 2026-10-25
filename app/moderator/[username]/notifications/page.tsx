import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { ModeratorNotifications } from "@/components/moderator/ModeratorNotifications";

export default async function ModeratorNotificationsPage() {
    const session = await getModSession();
    if (!session) redirect("/moderator/login");

    return (
        <ModeratorShell activeTab="notifications" moderator={session}>
            <ModeratorNotifications />
        </ModeratorShell>
    );
}
