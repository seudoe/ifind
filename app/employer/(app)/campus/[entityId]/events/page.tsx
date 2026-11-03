import { notFound } from "next/navigation";
import { CampusEventsManager } from "@/components/employer/CampusEventsManager";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";
import { internshipOptions } from "@/lib/campus/internshipOptions";

export default async function CampusEventsPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    return <CampusEventsManager entityId={entityId} canEdit={roleAtLeast(access.role, "coordinator")} internships={await internshipOptions(access.entity._id)} />;
}
