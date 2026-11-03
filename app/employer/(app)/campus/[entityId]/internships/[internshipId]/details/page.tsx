import { notFound } from "next/navigation";
import { CampusInternshipForm } from "@/components/employer/CampusInternshipForm";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";
import { loadCampusInternship, toCampusInternshipDTO } from "@/lib/campus/internships";
import { suggestionsOf } from "@/lib/campus/suggestions";
import { isResponse } from "@/lib/employer/access";

export default async function CampusInternshipDetailsPage({ params }: { params: Promise<{ entityId: string; internshipId: string }> }) {
    const { entityId, internshipId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const doc = await loadCampusInternship(access.entity._id, internshipId);
    if (isResponse(doc)) notFound();
    return (
        <CampusInternshipForm
            key={`${doc._id}:${doc.updatedAt.getTime()}`}
            entityId={entityId}
            initial={toCampusInternshipDTO(doc)}
            canEdit={roleAtLeast(access.role, "coordinator")}
            suggestions={suggestionsOf(access.entity)}
        />
    );
}
