import { ApplicantsTable } from "@/components/employer/ApplicantsTable";

export default async function ApplicantsPage({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    return <ApplicantsTable companyId={companyId} internshipId={internshipId} />;
}
