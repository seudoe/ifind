import { notFound } from "next/navigation";
import { CampusStudentsTable } from "@/components/employer/CampusStudentsTable";
import { getCampusAccess } from "@/lib/campus/access";

export default async function CampusStudentsPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    if (!(await getCampusAccess(entityId))) notFound();
    return <CampusStudentsTable entityId={entityId} />;
}
