import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import Application from "@/models/Application";
import PlatformInternship from "@/models/PlatformInternship";

/** Lands on the most useful tab: drafts need editing, posts with applicants show them, the rest show the overview. */
export default async function InternshipIndex({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    if (!mongoose.isValidObjectId(internshipId)) notFound();
    const i = await PlatformInternship.findOne({ _id: internshipId, companyId }).select("status").lean();
    if (!i) notFound();
    const base = `/employer/company/${companyId}/internships/${internshipId}`;
    if (i.status === "draft") redirect(`${base}/internship-details`);
    const hasApplicants = await Application.exists({ internshipId, companyId });
    redirect(`${base}/${hasApplicants ? "applicants" : "overview"}`);
}
