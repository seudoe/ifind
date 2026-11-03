import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { CampusInternshipTabs } from "@/components/employer/CampusInternshipTabs";
import { getCampusAccess } from "@/lib/campus/access";
import { syncCampusAutoClose } from "@/lib/campus/internships";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";

export default async function CampusInternshipLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ entityId: string; internshipId: string }>;
}) {
    const { entityId, internshipId } = await params;
    if (!mongoose.isValidObjectId(internshipId)) notFound();
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    await syncCampusAutoClose(access.entity._id); // lazy auto-close so the header shows the real status
    // Scoped by entity: an id from another campus is a 404, never a leak
    const internship = await CampusInternship.findOne({ _id: internshipId, entityId: access.entity._id }).select("company.name designation status").lean();
    if (!internship) notFound();
    const applicantCount = await CampusApplication.countDocuments({ entityId: access.entity._id, internshipId });

    return (
        <>
            <CampusInternshipTabs
                basePath={`/employer/campus/${entityId}/internships/${internshipId}`}
                company={internship.company.name}
                designation={internship.designation}
                status={internship.status}
                applicantCount={applicantCount}
            />
            {children}
        </>
    );
}
