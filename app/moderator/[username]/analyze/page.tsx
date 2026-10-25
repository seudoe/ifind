import { redirect } from "next/navigation";
import { getModSession } from "@/lib/moderatorAuth";
import { ModeratorShell } from "@/components/moderator/ModeratorShell";
import { AnalyzePanel } from "@/components/moderator/AnalyzePanel";
import { isAnalyzeKind } from "@/lib/moderator/analyze";
import { isObjectId } from "@/lib/validate";

type SearchParams = Promise<{ kind?: string; id?: string }>;

export default async function AnalyzePage({ searchParams }: { searchParams: SearchParams }) {
    const session = await getModSession();
    if (!session) redirect("/moderator/login");

    // /analyze?kind=employer&id=… opens that internship straight away (used by "Open in analyze" in the Companies tab)
    const { kind, id } = await searchParams;
    const initial = isAnalyzeKind(kind) && id && isObjectId(id) ? { kind, id } : null;

    return (
        <ModeratorShell activeTab="analyze" moderator={session}>
            <AnalyzePanel initial={initial} />
        </ModeratorShell>
    );
}
