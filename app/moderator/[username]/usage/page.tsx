import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { UsagePanel } from "@/components/moderator/UsagePanel";

export default async function UsagePage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="usage" moderator={session}>
            <UsagePanel />
        </ModeratorShell>
    );
}
