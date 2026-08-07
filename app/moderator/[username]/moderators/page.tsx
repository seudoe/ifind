import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { ModeratorsPanel } from "@/components/moderator/ModeratorsPanel";

export default async function ModeratorsPanelPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="moderators" moderator={session}>
            <ModeratorsPanel currentModeratorId={session.moderatorId} />
        </ModeratorShell>
    );
}
