import { notFound } from "next/navigation";
import { TeamManager } from "@/components/employer/TeamManager";
import { getCompanyAccess } from "@/lib/employer/access";

export default async function TeamPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    if (!(await getCompanyAccess(companyId))) notFound();
    return <TeamManager companyId={companyId} />;
}
