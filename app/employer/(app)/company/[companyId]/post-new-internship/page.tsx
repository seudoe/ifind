import { InternshipForm } from "@/components/employer/InternshipForm";

export default async function PostNewInternshipPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    return <InternshipForm companyId={companyId} title="Post a new internship" />;
}
