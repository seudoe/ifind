import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { CampusSidebar } from "@/components/employer/CampusSidebar";
import { getCampusAccess } from "@/lib/campus/access";
import College from "@/models/College";

export default async function CampusLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ entityId: string }>;
}) {
    const { entityId } = await params;
    // Non-members, deleted campuses and bad ids all look like 404
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const { entity, role } = access;
    const college = await College.findById(entity.collegeId).select("name").lean();
    const r = entity.restriction;

    return (
        <>
            <CampusSidebar entityId={entityId} name={entity.name} logo={entity.logo} collegeName={college?.name} role={role} />
            <main className="flex-1 min-w-0 p-4 md:p-8 pb-20 md:pb-8">
                {r && r.status !== "none" && (
                    <div role="alert" className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
                        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>This campus has been {r.status === "banned" ? "banned" : "restricted"} by iFind{r.reason ? `: ${r.reason}` : ""}. It can&apos;t post, email students or accept new joins.</p>
                    </div>
                )}
                {children}
            </main>
        </>
    );
}
