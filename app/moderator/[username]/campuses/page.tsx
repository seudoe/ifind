import { redirect } from "next/navigation";
import { CampusesPanel } from "@/components/moderator/CampusesPanel";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { getModSession } from "@/lib/moderatorAuth";

export default async function CampusesPanelPage() {
    const session = await getModSession();
    if (!session) redirect("/moderator/login");
    return (
        <ModeratorShell activeTab="campuses" moderator={session}>
            <CampusesPanel />
        </ModeratorShell>
    );
}
