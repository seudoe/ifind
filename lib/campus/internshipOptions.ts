import type mongoose from "mongoose";
import CampusInternship from "@/models/CampusInternship";
import type { InternshipOption } from "@/components/employer/CampusEventsManager";

/** Internships a staff member can attach an event to (their own campus only, newest first). */
export async function internshipOptions(entityId: mongoose.Types.ObjectId): Promise<InternshipOption[]> {
    const rows = await CampusInternship.find({ entityId, status: { $in: ["draft", "open", "closed"] } }).sort({ createdAt: -1 }).limit(200).select("company.name designation rounds.name").lean();
    return rows.map((r) => ({ id: String(r._id), label: `${r.company.name} · ${r.designation}`, rounds: r.rounds.map((x) => x.name) }));
}
