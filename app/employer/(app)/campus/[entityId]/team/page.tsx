import { notFound } from "next/navigation";
import { CampusTeamManager } from "@/components/employer/CampusTeamManager";
import { getCampusAccess } from "@/lib/campus/access";

export default async function CampusTeamPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    if (!(await getCampusAccess(entityId))) notFound();
    return <CampusTeamManager entityId={entityId} />;
}
