/**
 * Moves old per-member company notifications into notifications.company (one document per event).
 *
 * Before: an event like "New application" was inserted once per team member into notifications.employer.
 * After:  it is one document in notifications.company, visible to every member; read state lives in `readBy`.
 *
 *   npx tsx scripts/migrate-company-notifications.ts            dry run: prints what would change
 *   npx tsx scripts/migrate-company-notifications.ts --apply    writes the company documents, then deletes the copies
 *
 * Only company-wide types are touched (personal ones such as company_member_added stay where they are).
 * Copies are grouped by company + type + title + body + link + creation second.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { CompanyNotification, EmployerNotification } from "../models/Notification";
import type { NotificationType } from "../types/employer";

dotenv.config({ path: ".env.local" });

const COMPANY_TYPES: NotificationType[] = ["new_application", "application_withdrawn", "internship_approved", "internship_rejected", "internship_deadline", "company_verification"];

async function main() {
    const apply = process.argv.includes("--apply");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing in .env.local");
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });

    const old = await EmployerNotification.find({ type: { $in: COMPANY_TYPES }, companyId: { $ne: null } }).lean();
    const groups = new Map<string, typeof old>();
    for (const n of old) {
        const key = [n.companyId, n.type, n.title, n.body ?? "", n.link ?? "", Math.floor(n.createdAt.getTime() / 1000)].join("|");
        groups.set(key, [...(groups.get(key) ?? []), n]);
    }

    console.log(`${old.length} per-member notifications -> ${groups.size} company notifications (${apply ? "APPLYING" : "dry run"})`);
    if (!apply) return;

    for (const copies of groups.values()) {
        const first = copies[0];
        await CompanyNotification.create({
            companyId: first.companyId as mongoose.Types.ObjectId,
            type: first.type,
            title: first.title,
            body: first.body,
            link: first.link,
            actor: { kind: "system", name: "iFind" },
            readBy: copies.flatMap((c) => (c.readAt ? [{ employerId: c.recipientId, at: c.readAt }] : [])),
            createdAt: first.createdAt,
        });
        await EmployerNotification.deleteMany({ _id: { $in: copies.map((c) => c._id) } });
    }
    console.log("Done.");
}

main().then(() => mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
