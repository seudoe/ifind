import { notFound } from "next/navigation";
import { CompanySidebar } from "@/components/employer/CompanySidebar";
import { getCompanyAccess } from "@/lib/employer/access";
import Company from "@/models/Company";

export default async function CompanyLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ companyId: string }>;
}) {
    const { companyId } = await params;
    // Non-members, deleted companies and bad ids all look like 404
    const access = await getCompanyAccess(companyId);
    if (!access) notFound();
    const { company, employer, role } = access;

    const mine = await Company.find({
        "members.employerId": employer._id,
        isActive: true,
        "deleteDetails.deleted": { $ne: true },
    })
        .select("name")
        .sort({ name: 1 })
        .lean();

    return (
        <>
            <CompanySidebar
                companyId={companyId}
                name={company.name}
                logo={company.logo}
                verification={company.verification?.status ?? "unverified"}
                role={role}
                companies={mine.map((c) => ({ _id: String(c._id), name: c.name }))}
            />
            <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
        </>
    );
}
