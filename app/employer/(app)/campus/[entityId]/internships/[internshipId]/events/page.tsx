import { notFound } from "next/navigation";
import { CampusEventsManager } from "@/components/employer/CampusEventsManager";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";
import { internshipOptions } from "@/lib/campus/internshipOptions";
import { loadCampusInternship } from "@/lib/campus/internships";
import { isResponse } from "@/lib/employer/access";

export default async function CampusInternshipEventsPage({ params }: { params: Promise<{ entityId: string; internshipId: string }> }) {
    const { entityId, internshipId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const doc = await loadCampusInternship(access.entity._id, internshipId);
    if (isResponse(doc)) notFound();
    const options = (await internshipOptions(access.entity._id)).filter((o) => o.id === String(doc._id));
    return <CampusEventsManager entityId={entityId} internshipId={String(doc._id)} canEdit={roleAtLeast(access.role, "coordinator")} internships={options.length ? options : [{ id: String(doc._id), label: doc.designation, rounds: doc.rounds.map((r) => r.name) }]} />;
}
