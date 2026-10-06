import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { getCompanyAccess } from "@/lib/employer/access";
import { syncAutoClose } from "@/lib/employer/internships";
import { InternshipTabs } from "@/components/employer/InternshipTabs";
import Application from "@/models/Application";
import PlatformInternship from "@/models/PlatformInternship";

export default async function InternshipLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ companyId: string; internshipId: string }>;
}) {
    const { companyId, internshipId } = await params;
    // Company membership is already enforced by the parent layout; the internship must belong to it
    if (!mongoose.isValidObjectId(internshipId)) notFound();
    const access = await getCompanyAccess(companyId);
    if (access) await syncAutoClose(access.company); // lazy auto-close so the header shows the real status
    const internship = await PlatformInternship.findOne({ _id: internshipId, companyId })
        .select("name status moderation.status")
        .lean();
    if (!internship) notFound();
    const applicantCount = await Application.countDocuments({ internshipId, companyId });

    return (
        <>
            <InternshipTabs
                basePath={`/employer/company/${companyId}/internships/${internshipId}`}
                name={internship.name}
                status={internship.status}
                moderationStatus={internship.moderation.status}
                applicantCount={applicantCount}
            />
            {children}
        </>
    );
}
