import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { ScrapesPanel } from "@/components/moderator/ScrapesPanel";

export default async function ScrapesPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="scrapes" moderator={session}>
            <ScrapesPanel />
        </ModeratorShell>
    );
}
