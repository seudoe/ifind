import { redirect } from "next/navigation";

export default async function CompanyIndex({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    redirect(`/employer/company/${companyId}/overview`);
}
