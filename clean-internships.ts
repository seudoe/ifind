import fs from "fs";
import path from "path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const equalIdx = trimmed.indexOf("=");
        if (equalIdx !== -1) {
            const key = trimmed.slice(0, equalIdx).trim();
            const val = trimmed.slice(equalIdx + 1).trim();
            process.env[key] = val.replace(/^['"]|['"]$/g, "");
        }
    }
}



async function run() {
    try {
        const { connectDB } = require("./lib/db");
        const mongoose = require("mongoose");
        console.log("Connecting to Database...");
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) {
            console.error("Failed to connect to database");
            process.exit(1);
        }

        console.log("Fetching HNSW graph data...");
        // Retrieve the HNSW graph document from the database
        const graphDoc = await db.collection("internships.graph").findOne({ _id: "hnsw_internships_index" });

        if (!graphDoc || !graphDoc.uid_to_id) {
            console.error("HNSW graph or uid_to_id mapping not found in 'internships.graph' collection.");
            process.exit(1);
        }

        // Get all internship IDs that are currently in the HNSW graph
        const graphIds = new Set(Object.keys(graphDoc.uid_to_id));
        console.log(`Found ${graphIds.size} internships in the HNSW graph.`);

        console.log("Fetching internships from the 'internships' collection...");
        // Get all internship IDs from the internships collection
        const allInternships = await db.collection("internships").find({}, { projection: { _id: 1 } }).toArray();
        console.log(`Found ${allInternships.length} internships in the database.`);

        let deletedCount = 0;

        // Iterate and remove internships not in the graph
        for (const internship of allInternships) {
            const internshipIdStr = internship._id.toString();
            
            if (!graphIds.has(internshipIdStr)) {
                // If the internship is not in the graph, delete it from the internships collection
                await db.collection("internships").deleteOne({ _id: internship._id });
                deletedCount++;
                console.log(`Deleted internship: ${internshipIdStr}`);
            }
        }

        console.log(`\nCleanup Complete!`);
        console.log(`Successfully removed ${deletedCount} old internships that were missing from the HNSW graph.`);

        process.exit(0);
    } catch (error) {
        console.error("Error running script:", error);
        process.exit(1);
    }
}

run();
