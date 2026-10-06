import { InternshipForm } from "@/components/employer/InternshipForm";

export default async function PostNewInternshipPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    return (
        <div>
            <h1 className="text-lg font-bold text-[var(--text)] mb-5">Post a new internship</h1>
            <InternshipForm companyId={companyId} />
        </div>
    );
}
