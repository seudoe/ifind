import { notFound } from "next/navigation";
import { CampusInternshipForm } from "@/components/employer/CampusInternshipForm";
import { getCampusAccess } from "@/lib/campus/access";
import { suggestionsOf } from "@/lib/campus/suggestions";

export default async function PostNewCampusInternshipPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId, "coordinator");
    if (!access) notFound();
    return <CampusInternshipForm entityId={entityId} title="Post a new internship" suggestions={suggestionsOf(access.entity)} />;
}
