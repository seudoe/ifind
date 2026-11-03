import { notFound } from "next/navigation";
import { CampusSettings } from "@/components/employer/CampusSettings";
import { getCampusAccess, roleAtLeast } from "@/lib/campus/access";

export default async function CampusSettingsPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const access = await getCampusAccess(entityId);
    if (!access) notFound();
    const { entity, role } = access;
    const admin = roleAtLeast(role, "admin");

    return (
        <CampusSettings
            entityId={entityId}
            name={entity.name}
            canEdit={admin}
            canRotate={admin}
            joinCode={admin ? entity.joinCode : undefined}
            initial={{
                name: entity.name,
                description: entity.description ?? "",
                logo: entity.logo ?? undefined,
                coverImage: entity.coverImage ?? undefined,
                contactEmail: entity.contactEmail ?? undefined,
                contactPhone: entity.contactPhone ?? undefined,
                listing: entity.listing,
                courses: entity.courses.map((c) => ({ name: c.name, departments: [...c.departments] })),
                batches: [...entity.batches],
                uidLabel: entity.uidLabel,
                policy: { oneStudentOneOffer: !!entity.policy?.oneStudentOneOffer, acceptWindowHours: entity.policy?.acceptWindowHours ?? "" },
            }}
        />
    );
}
