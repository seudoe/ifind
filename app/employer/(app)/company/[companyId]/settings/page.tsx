import { notFound } from "next/navigation";
import { CompanySettings } from "@/components/employer/CompanySettings";
import { getCompanyAccess } from "@/lib/employer/access";
import type { CompanyInput } from "@/lib/employer/validation";

export default async function CompanySettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    // Recruiters can't edit the profile: the page is simply not there for them
    const access = await getCompanyAccess(companyId, "admin");
    if (!access) notFound();

    const c = JSON.parse(JSON.stringify(access.company.toObject()));
    // Form-shaped initial values (drop null/server-only fields so optional inputs stay empty)
    const initial = {
        name: c.name, legalName: c.legalName ?? "", tagline: c.tagline ?? "", description: c.description,
        logo: c.logo ?? "", coverImage: c.coverImage ?? "", website: c.website ?? "",
        industry: c.industry, companyType: c.companyType, size: c.size, foundedYear: c.foundedYear ?? undefined,
        headquarters: {
            line1: c.headquarters.line1 ?? "", line2: c.headquarters.line2 ?? "", city: c.headquarters.city,
            state: c.headquarters.state ?? "", country: c.headquarters.country, pincode: c.headquarters.pincode ?? "",
        },
        officeLocations: c.officeLocations, contactEmail: c.contactEmail, contactPhone: c.contactPhone ?? "",
        socials: { linkedin: c.socials?.linkedin ?? "", twitter: c.socials?.twitter ?? "", instagram: c.socials?.instagram ?? "", github: c.socials?.github ?? "" },
        registration: { gstin: c.registration?.gstin ?? "", cin: c.registration?.cin ?? "", pan: c.registration?.pan ?? "" },
        perks: c.perks, techStack: c.techStack,
    } as unknown as Partial<CompanyInput>;

    return (
        <CompanySettings
            companyId={companyId}
            initial={initial}
            verification={c.verification}
            isOwner={access.role === "owner"}
        />
    );
}
