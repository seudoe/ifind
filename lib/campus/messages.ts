/** Wording of campus messages. Pure functions (no I/O), shared by outbound email/SMS, in-app notifications and tests. */
export interface Built {
    subject: string;
    text: string;
    link?: string;
}

const when = (d?: Date | string | null) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST" : null);

export const newInternshipMessage = (p: { entityName: string; company: string; designation: string; deadline?: Date | string | null; link: string }): Built => ({
    subject: `New campus internship: ${p.company} - ${p.designation}`,
    text: `${p.entityName} posted a new internship: ${p.designation} at ${p.company}.${p.deadline ? ` Apply before ${when(p.deadline)}.` : ""}`,
    link: p.link,
});

export type EventChange = "created" | "updated" | "cancelled";

export const eventMessage = (p: { entityName: string; title: string; change: EventChange; startsAt?: Date | string | null; venue?: string | null; link: string; changed?: string[] }): Built => {
    const head = p.change === "created" ? "New" : p.change === "updated" ? "Updated" : "Cancelled";
    const lines = [`${p.entityName}: ${head.toLowerCase()} event "${p.title}".`];
    if (p.change !== "cancelled" && p.startsAt) lines.push(`When: ${when(p.startsAt)}.`);
    if (p.change !== "cancelled" && p.venue) lines.push(`Where: ${p.venue}.`);
    if (p.change === "updated" && p.changed?.length) lines.push(`Changed: ${p.changed.join(", ")}.`);
    return { subject: `${head} campus event: ${p.title}`, text: lines.join(" "), link: p.link };
};

export const applicationStatusMessage = (p: { company: string; designation: string; status: string; link: string }): Built => ({
    subject: `Your application to ${p.company} is now ${p.status.replace(/_/g, " ")}`,
    text: `Your campus application for ${p.designation} at ${p.company} is now ${p.status.replace(/_/g, " ")}.`,
    link: p.link,
});

export const removedMessage = (p: { company: string; designation: string; reason?: string | null; link: string }): Built => ({
    subject: `Removed from ${p.company} - ${p.designation}`,
    text: `The campus staff removed you from ${p.designation} at ${p.company}.${p.reason ? ` Reason: ${p.reason}.` : ""} You can still apply to other internships.`,
    link: p.link,
});

export const bannedMessage = (p: { entityName: string; reason: string; link: string }): Built => ({
    subject: `You can't apply to ${p.entityName} internships`,
    text: `${p.entityName} has barred you from future campus internships. Reason: ${p.reason}.`,
    link: p.link,
});

export const unbannedMessage = (p: { entityName: string; link: string }): Built => ({
    subject: `You can apply to ${p.entityName} internships again`,
    text: `${p.entityName} lifted the restriction on your account. You can apply to its internships again.`,
    link: p.link,
});

export const staffAddedMessage = (p: { entityName: string; role: string; link: string }): Built => ({
    subject: `You were added to ${p.entityName}`,
    text: `You now have the ${p.role} role in ${p.entityName} on iFind.`,
    link: p.link,
});

export const staffRemovedMessage = (p: { entityName: string }): Built => ({
    subject: `You were removed from ${p.entityName}`,
    text: `You no longer have access to ${p.entityName} on iFind.`,
});

export const entityClosedMessage = (p: { entityName: string; link: string }): Built => ({
    subject: `${p.entityName} is no longer available`,
    text: `${p.entityName} was deleted or restricted. Your applications there were withdrawn. You can join another campus from College details.`,
    link: p.link,
});

export const reminderMessage = (p: { title: string; startsAt?: Date | string | null; link: string }): Built => ({
    subject: `Reminder: ${p.title}`,
    text: `Reminder: ${p.title}${p.startsAt ? ` at ${when(p.startsAt)}` : ""}.`,
    link: p.link,
});
