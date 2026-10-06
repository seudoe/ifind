import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin } from "lucide-react";
import { VerificationBadge } from "@/components/employer/VerificationBadge";
import { Badge } from "@/components/ui/Badge";
import { getCompanyAccess } from "@/lib/employer/access";
import Application from "@/models/Application";
import PlatformInternship from "@/models/PlatformInternship";

export default async function CompanyOverviewPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    const access = await getCompanyAccess(companyId);
    if (!access) notFound();
    const { company } = access;

    const [byStatus, apps] = await Promise.all([
        PlatformInternship.aggregate<{ _id: string; n: number }>([
            { $match: { companyId: company._id } },
            { $group: { _id: "$status", n: { $sum: 1 } } },
        ]),
        Application.aggregate<{ _id: string; n: number }>([
            { $match: { companyId: company._id } },
            { $group: { _id: "$status", n: { $sum: 1 } } },
        ]),
    ]);
    const n = (rows: { _id: string; n: number }[], k: string) => rows.find((r) => r._id === k)?.n ?? 0;
    const stats = [
        { label: "Published", value: n(byStatus, "published") },
        { label: "Drafts", value: n(byStatus, "draft") },
        { label: "Total applicants", value: apps.reduce((a, r) => a + r.n, 0) },
        { label: "New applicants", value: n(apps, "applied") },
    ];
    const hq = company.headquarters;
    const v = company.verification;

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-bold text-[var(--text)]">{company.name}</h1>
                    <VerificationBadge status={v?.status ?? "unverified"} />
                </div>
                {company.tagline && <p className="text-sm text-[var(--text-2)] mt-0.5">{company.tagline}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className="plasma-card p-4">
                        <p className="text-2xl font-bold text-[var(--text)]">{s.value}</p>
                        <p className="text-xs text-[var(--text-3)]">{s.label}</p>
                    </div>
                ))}
            </div>

            {v?.status !== "verified" && (
                <div className="rounded-[var(--radius)] border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-800">
                    {v?.status === "rejected"
                        ? `Verification was rejected${v.rejectionReason ? `: ${v.rejectionReason}` : "."}`
                        : "This company is not verified yet. Its internships always go through moderator review before students see them."}
                </div>
            )}

            <div className="plasma-card p-5 space-y-3">
                <p className="text-sm text-[var(--text)] whitespace-pre-line">{company.description}</p>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{company.industry}</Badge>
                    <Badge variant="secondary" className="capitalize">{company.companyType}</Badge>
                    <Badge variant="secondary">{company.size} employees</Badge>
                    {company.foundedYear && <Badge variant="secondary">Founded {company.foundedYear}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--text-2)]">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{[hq.city, hq.state, hq.country].filter(Boolean).join(", ")}</span>
                    {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[var(--primary)] hover:underline">
                            <Globe className="h-4 w-4" />{company.website}
                        </a>
                    )}
                </div>
                {company.perks.length > 0 && <p className="text-xs text-[var(--text-3)]">Perks: {company.perks.join(", ")}</p>}
                {company.techStack.length > 0 && <p className="text-xs text-[var(--text-3)]">Tech: {company.techStack.join(", ")}</p>}
            </div>

            <Link href={`/employer/company/${companyId}/post-new-internship`} className="inline-block text-sm text-[var(--primary)] hover:underline">
                Post a new internship →
            </Link>
        </div>
    );
}
