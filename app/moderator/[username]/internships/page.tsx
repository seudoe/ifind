import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { InternshipsPanel } from "@/components/moderator/InternshipsPanel";

export default async function InternshipsPanelPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="internships" moderator={session}>
            <InternshipsPanel />
        </ModeratorShell>
    );
}
