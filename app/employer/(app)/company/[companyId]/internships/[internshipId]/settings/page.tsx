import { notFound } from "next/navigation";
import { InternshipActions } from "@/components/employer/InternshipActions";
import PlatformInternship from "@/models/PlatformInternship";

export default async function InternshipSettingsPage({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    const i = await PlatformInternship.findOne({ _id: internshipId, companyId }).select("status").lean();
    if (!i) notFound();
    return <InternshipActions companyId={companyId} internshipId={internshipId} status={i.status} />;
}
