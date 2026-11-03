/** Read-only: prints the shape of the `colleges` collection. Never writes. `npx tsx scripts/inspect-colleges.ts` */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });

async function main() {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing in .env.local");
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    const col = mongoose.connection.collection("colleges");
    const count = await col.estimatedDocumentCount();
    console.log("colleges docs:", count);
    const sample = await col.find({}).limit(3).toArray();
    console.log(JSON.stringify(sample, null, 2));
    const keys = new Map<string, number>();
    for (const d of await col.find({}).limit(500).toArray()) for (const k of Object.keys(d)) keys.set(k, (keys.get(k) ?? 0) + 1);
    console.log("field frequency (first 500):", Object.fromEntries(keys));
    console.log("indexes:", (await col.indexes()).map((i) => i.name));
    await mongoose.disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
