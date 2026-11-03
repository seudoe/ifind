/**
 * Creates the indexes of the campus collections only. Never touches `colleges` (owner-populated, read-only).
 *   npx tsx scripts/ensure-campus-indexes.ts
 * Safe to re-run. Run once per database before launch.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import CampusApplication from "../models/CampusApplication";
import CampusBlacklist from "../models/CampusBlacklist";
import CampusEnrollment from "../models/CampusEnrollment";
import CampusEntity from "../models/CampusEntity";
import CampusEntityReport from "../models/CampusEntityReport";
import CampusEvent from "../models/CampusEvent";
import CampusInternship from "../models/CampusInternship";
import CollegeNotification from "../models/CollegeNotification";
import OutboundMessage from "../models/OutboundMessage";

dotenv.config({ path: ".env.local" });

const MODELS = [CampusEntity, CampusEnrollment, CampusEntityReport, CampusBlacklist, CampusInternship, CampusEvent, CampusApplication, CollegeNotification, OutboundMessage];

async function main() {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing in .env.local");
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    for (const m of MODELS) {
        await m.createCollection().catch(() => undefined); // exists already
        await m.syncIndexes();
        console.log(`ok  ${m.collection.name}  ${(await m.collection.indexes()).map((i) => i.name).join(", ")}`);
    }
    await mongoose.disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
