import { notFound } from "next/navigation";
import { CampusInternshipStart } from "@/components/employer/CampusInternshipStart";
import { getCampusAccess } from "@/lib/campus/access";
import { suggestionsOf } from "@/lib/campus/suggestions";

export default async function PostNewCampusInternshipPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId, "coordinator");
    if (!access) notFound();
    return <CampusInternshipStart entityId={entityId} suggestions={suggestionsOf(access.entity)} />;
}
