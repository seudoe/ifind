import type { NotificationType } from "@/types/employer";

/**
 * Two levels of notification:
 *   critical  stored in the inbox AND emailed (Brevo): things the person must not miss
 *   normal    stored in the inbox only: they see it next time they sign in
 *
 * This table is the one place that decides. A call can still override it (e.g. application_status is critical only
 * for the good news / next steps), by passing `priority` to notify() / notifyCompany().
 */
export const NOTIFICATION_PRIORITIES = ["critical", "normal"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const DEFAULT_PRIORITY: Record<NotificationType, NotificationPriority> = {
    // someone's job-search or hiring outcome changed
    application_status: "normal", // overridden per status, see criticalApplicationStatus
    internship_approved: "critical",
    internship_rejected: "critical",
    company_restriction: "critical",
    company_verification: "critical",
    // access and security
    account_security: "critical",
    account_status: "critical",
    moderator_status: "critical",
    company_member_added: "critical",
    company_member_removed: "critical",
    // everything else is an inbox item
    new_application: "normal",
    application_withdrawn: "normal",
    application_submitted: "normal",
    internship_deadline: "normal",
    internship_pending_review: "normal",
    internship_status: "normal",
    internship_closed: "normal",
    company_member_role: "normal",
    moderator_pending: "normal",
    resume_updated: "normal",
    welcome: "normal",
    system: "normal",
};

/** Moves in the hiring pipeline a student should hear about by email (a rejection is inbox-only). */
export const criticalApplicationStatus = (status: string) => ["shortlisted", "interview", "offered", "hired"].includes(status);
