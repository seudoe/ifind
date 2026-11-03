import { notFound } from "next/navigation";
import { CampusInternshipsTable } from "@/components/employer/CampusInternshipsTable";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";

export default async function CampusInternshipsPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    return <CampusInternshipsTable entityId={entityId} canPost={roleAtLeast(access.role, "coordinator")} />;
}
