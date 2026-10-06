import { redirect } from "next/navigation";

export default async function InternshipIndex({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    redirect(`/employer/company/${companyId}/internships/${internshipId}/overview`);
}
