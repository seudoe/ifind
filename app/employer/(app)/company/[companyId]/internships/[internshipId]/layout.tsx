import mongoose from "mongoose";
import { notFound } from "next/navigation";
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
