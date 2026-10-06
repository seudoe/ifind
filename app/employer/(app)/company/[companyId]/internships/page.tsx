import { InternshipsTable } from "@/components/employer/InternshipsTable";

export default async function InternshipsPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    return <InternshipsTable companyId={companyId} />;
}
