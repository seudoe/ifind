import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { InstitutesList } from "@/components/employer/InstitutesList";
import { Button } from "@/components/ui/Button";
import { listInstitutes } from "@/lib/campus/entities";
import { getValidEmployer } from "@/lib/employer/access";

export const dynamic = "force-dynamic";

export default async function InstitutesPage() {
    const employer = await getValidEmployer();
    if (!employer) redirect("/employer/login");
    const rows = await listInstitutes(employer._id);

    return (
        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-5xl">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-lg font-bold text-[var(--heading)]">Your institutes</h1>
                    <p className="text-sm text-[var(--text-3)]">Companies post internships on iFind. College campuses run on-campus drives for their own students.</p>
                </div>
                <Link href="/employer/institutes/new">
                    <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add new</Button>
                </Link>
            </div>
            <InstitutesList rows={JSON.parse(JSON.stringify(rows))} />
        </main>
    );
}
