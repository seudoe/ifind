import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { EmployersPanel } from "@/components/moderator/EmployersPanel";

export default async function EmployersPanelPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="employers" moderator={session}>
            <EmployersPanel />
        </ModeratorShell>
    );
}
