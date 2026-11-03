import { notFound } from "next/navigation";
import { CampusInternshipActions } from "@/components/employer/CampusInternshipActions";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";
import { loadCampusInternship } from "@/lib/campus/internships";
import { isResponse } from "@/lib/employer/access";

export default async function CampusInternshipSettingsPage({ params }: { params: Promise<{ entityId: string; internshipId: string }> }) {
    const { entityId, internshipId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const doc = await loadCampusInternship(access.entity._id, internshipId);
    if (isResponse(doc)) notFound();
    if (!roleAtLeast(access.role, "coordinator")) {
        return <p className="plasma-card max-w-2xl p-5 text-sm text-[var(--text-2)]">Only coordinators and above can publish, close or duplicate internships.</p>;
    }
    return <CampusInternshipActions entityId={entityId} internshipId={String(doc._id)} status={doc.status} />;
}
