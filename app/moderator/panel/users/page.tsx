import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { UsersPanel } from "@/components/moderator/UsersPanel";

export default async function UsersPanelPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="users" moderator={session}>
            <UsersPanel />
        </ModeratorShell>
    );
}
