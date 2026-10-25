"use client";

import { useRouter } from "next/navigation";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";

/** Marking something read refreshes the server-rendered shell so the sidebar badge follows. */
export function ModeratorNotifications() {
    const router = useRouter();
    return <NotificationInbox endpoint="/api/moderator/notifications" onChange={() => router.refresh()} />;
}
