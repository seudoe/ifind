/**
 * Seeds fake applications (the student apply flow doesn't exist yet) for one published internship,
 * using existing users' resumes. Writes to the DB in MONGODB_URI.
 *
 *   npx tsx scripts/seed-applications.ts <internshipId> [count=10]
 *   npx tsx scripts/seed-applications.ts --clean <internshipId>     (removes what this script created)
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApplication } from "../lib/employer/applications";
import Application from "../models/Application";
import Notification from "../models/Notification";
import PlatformInternship from "../models/PlatformInternship";
import User from "../models/User";

dotenv.config({ path: ".env.local" });

const SEED_NOTE = "seeded"; // marks seeded rows so --clean only removes them

async function main() {
    const args = process.argv.slice(2);
    const clean = args[0] === "--clean";
    const internshipId = clean ? args[1] : args[0];
    const count = Math.min(Math.max(parseInt(clean ? "0" : args[1] ?? "10", 10) || 10, 1), 200);
    if (!internshipId || !mongoose.isValidObjectId(internshipId)) {
        console.error("Usage: npx tsx scripts/seed-applications.ts <internshipId> [count] | --clean <internshipId>");
        process.exit(1);
    }
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing in .env.local");
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });

    try {
        if (clean) {
            const a = await Application.deleteMany({ internshipId, "statusHistory.0.note": SEED_NOTE });
            const n = await Notification.deleteMany({ type: "new_application", link: new RegExp(`/internships/${internshipId}/`) });
            console.log(`Removed ${a.deletedCount} seeded applications and ${n.deletedCount} notifications`);
            return;
        }

        const internship = await PlatformInternship.findById(internshipId);
        if (!internship) throw new Error("Internship not found");
        if (internship.status !== "published") throw new Error(`Internship is ${internship.status}; publish it first`);

        const already = (await Application.find({ internshipId }).select("studentId").lean()).map((a) => a.studentId);
        const users = await User.find({ _id: { $nin: already }, isBanned: { $ne: true }, "deleteDetails.deleted": { $ne: true } }).limit(count * 3);
        const picked = users.sort(() => Math.random() - 0.5).slice(0, count);
        if (!picked.length) throw new Error("No eligible users found");

        let made = 0;
        for (const user of picked) {
            try {
                const app = await createApplication(internship, user, { note: SEED_NOTE });
                // Spread over the last 10 days so the overview chart has a shape
                const when = new Date(Date.now() - Math.random() * 10 * 86_400_000);
                await Application.updateOne({ _id: app._id }, { $set: { appliedAt: when, "statusHistory.0.changedAt": when } });
                made++;
            } catch (err) {
                console.warn(`Skipped ${user.email}: ${err instanceof Error ? err.message : err}`);
            }
        }
        console.log(`Created ${made} applications for "${internship.name}"`);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
