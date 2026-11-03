import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { JoinCodeCard } from "@/components/employer/JoinCodeCard";
import { Badge } from "@/components/ui/Badge";
import { roleAtLeast, getCampusAccess } from "@/lib/campus/access";
import CampusApplication from "@/models/CampusApplication";
import CampusEnrollment from "@/models/CampusEnrollment";
import CampusInternship from "@/models/CampusInternship";
import College from "@/models/College";

export default async function CampusOverviewPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const { entity, role } = access;

    const [college, open, drafts, students, newApps] = await Promise.all([
        College.findById(entity.collegeId).select("name").lean(),
        CampusInternship.countDocuments({ entityId: entity._id, status: "open" }),
        CampusInternship.countDocuments({ entityId: entity._id, status: "draft" }),
        CampusEnrollment.countDocuments({ entityId: entity._id }),
        CampusApplication.countDocuments({ entityId: entity._id, status: "applied" }),
    ]);
    const stats = [
        { label: "Open internships", value: open },
        { label: "Drafts", value: drafts },
        { label: "Students joined", value: students },
        { label: "New applicants", value: newApps },
    ];

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-bold text-[var(--heading)]">{entity.name}</h1>
                    <span className="inline-flex items-center rounded-[var(--radius-xl)] bg-[var(--campus-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--campus)]">College</span>
                </div>
                {college?.name && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--text-2)]"><GraduationCap className="h-4 w-4 text-[var(--campus)]" />{college.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className="plasma-card p-4">
                        <p className="text-2xl font-bold text-[var(--text)]">{s.value}</p>
                        <p className="text-xs text-[var(--text-3)]">{s.label}</p>
                    </div>
                ))}
            </div>

            {roleAtLeast(role, "admin") && <JoinCodeCard entityId={entityId} name={entity.name} code={entity.joinCode} canRotate />}

            <div className="plasma-card p-5 space-y-3">
                {entity.description && <p className="text-sm text-[var(--text)] whitespace-pre-line">{entity.description}</p>}
                <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{entity.listing === "listed" ? "Listed for students" : "Join by code only"}</Badge>
                    <Badge variant="secondary">{entity.members.length} staff</Badge>
                    {entity.batches.length > 0 && <Badge variant="secondary">Batches {entity.batches.join(", ")}</Badge>}
                    {entity.policy?.oneStudentOneOffer && <Badge variant="secondary">One student, one offer</Badge>}
                </div>
            </div>
        </div>
    );
}
