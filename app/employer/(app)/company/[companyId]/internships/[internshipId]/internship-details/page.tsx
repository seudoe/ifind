import { notFound } from "next/navigation";
import { InternshipForm } from "@/components/employer/InternshipForm";
import { toInternshipDTO } from "@/lib/employer/internships";
import PlatformInternship from "@/models/PlatformInternship";

export default async function InternshipDetailsPage({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    const doc = await PlatformInternship.findOne({ _id: internshipId, companyId });
    if (!doc) notFound();
    // key: remount the form when the stored version changes (e.g. after a router.refresh)
    return <InternshipForm key={String(doc.updatedAt)} companyId={companyId} initial={toInternshipDTO(doc)} />;
}
