import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { CompaniesPanel } from "@/components/moderator/CompaniesPanel";

export default async function CompaniesPanelPage() {
    const session = await getModSession();
    if (!session) {
        redirect("/moderator/login");
    }

    return (
        <ModeratorShell activeTab="companies" moderator={session}>
            <CompaniesPanel />
        </ModeratorShell>
    );
}
