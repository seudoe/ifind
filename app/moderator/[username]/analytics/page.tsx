import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { AnalyticsPanel } from "@/components/moderator/AnalyticsPanel";

export default async function AnalyticsPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="analytics" moderator={session}>
            <AnalyticsPanel />
        </ModeratorShell>
    );
}
