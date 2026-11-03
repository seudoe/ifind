import { notFound } from "next/navigation";
import { CampusApplicantsTable } from "@/components/employer/CampusApplicantsTable";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";
import { loadCampusInternship } from "@/lib/campus/internships";
import { isResponse } from "@/lib/employer/access";

export default async function CampusInternshipApplicantsPage({ params }: { params: Promise<{ entityId: string; internshipId: string }> }) {
    const { entityId, internshipId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const doc = await loadCampusInternship(access.entity._id, internshipId);
    if (isResponse(doc)) notFound();
    return <CampusApplicantsTable entityId={entityId} internshipId={String(doc._id)} canEdit={roleAtLeast(access.role, "coordinator")} />;
}
