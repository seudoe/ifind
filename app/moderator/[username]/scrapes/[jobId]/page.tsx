import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { ScrapeDetail } from "@/components/moderator/ScrapeDetail";

export default async function ScrapeDetailPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="scrapes" moderator={session}>
            <ScrapeDetail />
        </ModeratorShell>
    );
}
