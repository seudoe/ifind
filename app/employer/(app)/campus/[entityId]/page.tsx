import { redirect } from "next/navigation";

export default async function CampusIndex({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    redirect(`/employer/campus/${entityId}/overview`);
}
