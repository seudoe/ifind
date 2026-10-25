import { redirect } from "next/navigation";
import { EmployerShell } from "@/components/employer/EmployerShell";
import { getValidEmployer } from "@/lib/employer/access";
import { employerUnreadCount } from "@/lib/employer/notifications";

export default async function EmployerAppLayout({ children }: { children: React.ReactNode }) {
    // proxy.ts already checks the cookie; this re-checks the account (exists, not banned/deleted)
    const employer = await getValidEmployer();
    if (!employer) redirect("/employer/login");

    const unread = await employerUnreadCount(employer._id);

    return (
        <EmployerShell name={employer.name} picture={employer.profilePicture} unread={unread}>
            {children}
        </EmployerShell>
    );
}
