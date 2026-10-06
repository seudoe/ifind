import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { VerificationBadge } from "@/components/employer/VerificationBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getValidEmployer } from "@/lib/employer/access";
import Application from "@/models/Application";
import Company from "@/models/Company";
import PlatformInternship from "@/models/PlatformInternship";

export default async function CompaniesPage() {
    const employer = (await getValidEmployer())!; // layout guarantees it

    const companies = await Company.find({
        "members.employerId": employer._id,
        isActive: true,
        "deleteDetails.deleted": { $ne: true },
    })
        .sort({ createdAt: -1 })
        .lean();
    const ids = companies.map((c) => c._id);

    const [published, applicants] = await Promise.all([
        PlatformInternship.aggregate<{ _id: unknown; n: number }>([
            { $match: { companyId: { $in: ids }, status: "published" } },
            { $group: { _id: "$companyId", n: { $sum: 1 } } },
        ]),
        Application.aggregate<{ _id: unknown; n: number }>([
            { $match: { companyId: { $in: ids }, status: "applied" } },
            { $group: { _id: "$companyId", n: { $sum: 1 } } },
        ]),
    ]);
    const count = (rows: { _id: unknown; n: number }[], id: unknown) => rows.find((r) => String(r._id) === String(id))?.n ?? 0;

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-5xl">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-lg font-bold text-[var(--text)]">Your companies</h1>
                    <p className="text-sm text-[var(--text-3)]">Pick a company to post internships and manage applicants.</p>
                </div>
                <Link href="/employer/companies/new">
                    <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Register new company</Button>
                </Link>
            </div>

            {companies.length === 0 ? (
                <div className="plasma-card p-10 text-center">
                    <Building2 className="mx-auto h-10 w-10 text-[var(--text-3)] mb-3" />
                    <p className="font-medium text-[var(--text)]">No companies yet</p>
                    <p className="text-sm text-[var(--text-3)] mb-4">Register a company to start posting internships.</p>
                    <Link href="/employer/companies/new"><Button>Register your first company</Button></Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {companies.map((c) => {
                        const role = c.members.find((m) => String(m.employerId) === String(employer._id))?.role ?? "recruiter";
                        const newApps = count(applicants, c._id);
                        return (
                            <Link key={String(c._id)} href={`/employer/company/${c._id}/overview`} className="plasma-card p-4 block hover:shadow-[var(--shadow)] transition-shadow">
                                <div className="flex items-start gap-3">
                                    {c.logo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={c.logo} alt={c.name} className="h-11 w-11 rounded-[var(--radius-sm)] object-cover shrink-0" />
                                    ) : (
                                        <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-[var(--primary-bg)] flex items-center justify-center shrink-0">
                                            <Building2 className="h-5 w-5 text-[var(--primary)]" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-[var(--text)]">{c.name}</p>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            <VerificationBadge status={c.verification?.status ?? "unverified"} />
                                            <Badge variant="outline" className="capitalize">{role}</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                                    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] py-2">
                                        <p className="text-lg font-bold text-[var(--text)]">{count(published, c._id)}</p>
                                        <p className="text-[11px] text-[var(--text-3)]">Published</p>
                                    </div>
                                    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] py-2">
                                        <p className={`text-lg font-bold ${newApps ? "text-[var(--primary)]" : "text-[var(--text)]"}`}>{newApps}</p>
                                        <p className="text-[11px] text-[var(--text-3)]">New applicants</p>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
