import { ApplicantsTable } from "@/components/employer/ApplicantsTable";

export default async function ApplicantsPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    return (
        <div>
            <h1 className="text-lg font-bold text-[var(--text)] mb-5">Applicants</h1>
            <ApplicantsTable companyId={companyId} />
        </div>
    );
}
