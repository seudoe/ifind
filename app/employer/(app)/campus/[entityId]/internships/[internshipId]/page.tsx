import { redirect } from "next/navigation";

export default async function CampusInternshipIndex({ params }: { params: Promise<{ entityId: string; internshipId: string }> }) {
    const { entityId, internshipId } = await params;
    redirect(`/employer/campus/${entityId}/internships/${internshipId}/details`);
}
