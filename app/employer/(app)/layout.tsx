import { redirect } from "next/navigation";
import { EmployerShell } from "@/components/employer/EmployerShell";
import { getValidEmployer } from "@/lib/employer/access";
import Notification from "@/models/Notification";

export default async function EmployerAppLayout({ children }: { children: React.ReactNode }) {
    // proxy.ts already checks the cookie; this re-checks the account (exists, not banned/deleted)
    const employer = await getValidEmployer();
    if (!employer) redirect("/employer/login");

    const unread = await Notification.countDocuments({
        recipientType: "employer",
        recipientId: employer._id,
        readAt: null,
    });

    return (
        <EmployerShell name={employer.name} picture={employer.profilePicture} unread={unread}>
            {children}
        </EmployerShell>
    );
}
