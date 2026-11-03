import { notFound } from "next/navigation";
import { CampusStudentsArea } from "@/components/employer/CampusStudentsArea";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";

export default async function CampusStudentsPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    return <CampusStudentsArea entityId={entityId} canEdit={roleAtLeast(access.role, "coordinator")} />;
}
