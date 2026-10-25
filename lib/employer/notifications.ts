import mongoose from "mongoose";
import Company from "@/models/Company";
import { CompanyNotification, EmployerNotification } from "@/models/Notification";
import type { AppNotification } from "@/types/employer";

type Id = string | mongoose.Types.ObjectId;
const oid = (v: Id) => new mongoose.Types.ObjectId(String(v));

/**
 * An employer's inbox = personal notifications (notifications.employer) + the company notifications
 * (notifications.company) of every company they belong to. Company ones are stored once per event and are shown from
 * the day the person joined that company, so a new teammate does not inherit the company's whole history.
 */
async function companyScope(employerId: Id) {
    const companies = await Company.find({ "members.employerId": oid(employerId), "deleteDetails.deleted": { $ne: true } })
        .select("name members.employerId members.addedAt")
        .lean();
    const scopes = companies.map((c) => ({
        companyId: c._id as mongoose.Types.ObjectId,
        name: c.name,
        since: c.members.find((m) => String(m.employerId) === String(employerId))?.addedAt ?? new Date(0),
    }));
    // $or of (company, since) pairs; an empty $or is invalid, so match nothing explicitly
    const filter = scopes.length ? { $or: scopes.map((s) => ({ companyId: s.companyId, createdAt: { $gte: s.since } })) } : { _id: { $in: [] } };
    return { scopes, filter };
}

export async function employerUnreadCount(employerId: Id): Promise<number> {
    const me = oid(employerId);
    const { filter } = await companyScope(me);
    const [personal, company] = await Promise.all([
        EmployerNotification.countDocuments({ recipientType: "employer", recipientId: me, readAt: null }),
        CompanyNotification.countDocuments({ ...filter, "readBy.employerId": { $ne: me } }),
    ]);
    return personal + company;
}

export async function employerFeed(employerId: Id, limit = 100): Promise<{ items: AppNotification[]; unread: number }> {
    const me = oid(employerId);
    const { scopes, filter } = await companyScope(me);
    const names = new Map(scopes.map((s) => [String(s.companyId), s.name]));

    const [personal, company] = await Promise.all([
        EmployerNotification.find({ recipientType: "employer", recipientId: me }).sort({ createdAt: -1 }).limit(limit).lean(),
        CompanyNotification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    const items: AppNotification[] = [
        ...personal.map((n) => ({
            _id: String(n._id),
            recipientType: n.recipientType,
            recipientId: String(n.recipientId),
            type: n.type,
            title: n.title,
            body: n.body ?? null,
            link: n.link ?? null,
            companyId: n.companyId ? String(n.companyId) : null,
            companyName: n.companyId ? names.get(String(n.companyId)) ?? null : null,
            scope: "personal" as const,
            priority: n.priority,
            readAt: n.readAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
        })),
        ...company.map((n) => ({
            _id: String(n._id),
            recipientType: "employer" as const,
            recipientId: String(me),
            type: n.type,
            title: n.title,
            body: n.body ?? null,
            link: n.link ?? null,
            companyId: String(n.companyId),
            companyName: names.get(String(n.companyId)) ?? null,
            scope: "company" as const,
            priority: n.priority,
            actorName: n.actor?.name ?? null,
            readAt: n.readBy?.find((r) => String(r.employerId) === String(me))?.at.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
        })),
    ]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);

    return { items, unread: await employerUnreadCount(me) };
}

/** { id, scope } marks one read; { all: true } marks every personal and company notification read for this person. */
export async function markEmployerRead(employerId: Id, target: { id: string; scope: "personal" | "company" } | { all: true }) {
    const me = oid(employerId);
    const now = new Date();
    if ("all" in target) {
        const { filter } = await companyScope(me);
        await Promise.all([
            EmployerNotification.updateMany({ recipientType: "employer", recipientId: me, readAt: null }, { $set: { readAt: now } }),
            CompanyNotification.updateMany({ ...filter, "readBy.employerId": { $ne: me } }, { $push: { readBy: { employerId: me, at: now } } }),
        ]);
        return;
    }
    if (target.scope === "company") {
        const { filter } = await companyScope(me); // only notifications of companies they belong to can be touched
        await CompanyNotification.updateOne({ $and: [{ _id: oid(target.id) }, filter], "readBy.employerId": { $ne: me } }, { $push: { readBy: { employerId: me, at: now } } });
    } else {
        await EmployerNotification.updateOne({ _id: oid(target.id), recipientType: "employer", recipientId: me, readAt: null }, { $set: { readAt: now } });
    }
}
