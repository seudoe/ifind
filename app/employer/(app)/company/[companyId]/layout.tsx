import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { CompanySidebar } from "@/components/employer/CompanySidebar";
import { getCompanyAccess, getRestriction, restrictionMessage } from "@/lib/employer/access";
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

    const restriction = await getRestriction(company._id);

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
            <main className="flex-1 min-w-0 p-4 md:p-8">
                {restriction.status !== "none" && (
                    <div role="alert" className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
                        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>{restrictionMessage(restriction)}</p>
                    </div>
                )}
                {children}
            </main>
        </>
    );
}
