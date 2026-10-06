import { redirect } from "next/navigation";

/** Old name of the Applicants tab; kept so existing notification links still work. */
export default async function StudentsAppliedRedirect({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    redirect(`/employer/company/${companyId}/internships/${internshipId}/applicants`);
}
