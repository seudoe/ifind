import mongoose from "mongoose";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local if present
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is missing from environment / .env.local");
  process.exit(1);
}

const BACKUP_FILE = path.join(__dirname, "users_backup.json");
const action = process.argv[2] || "fetch";

async function run() {
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(MONGODB_URI as string);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("Error: MongoDB connection failed");
    process.exit(1);
  }

  const collection = db.collection("users");

  if (action === "fetch") {
    console.log("Fetching all user documents from MongoDB...");
    const users = await collection.find({}).toArray();
    console.log(`Found ${users.length} users.`);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(users, null, 2), "utf8");
    console.log(`Successfully saved ${users.length} users to ${BACKUP_FILE}`);
  } else if (action === "transform") {
    if (!fs.existsSync(BACKUP_FILE)) {
      console.error(`Error: Backup file ${BACKUP_FILE} not found! Run fetch first.`);
      process.exit(1);
    }
    console.log(`Transforming users structure in ${BACKUP_FILE}...`);
    const rawData = fs.readFileSync(BACKUP_FILE, "utf8");
    const users = JSON.parse(rawData);

    const transformedUsers = users.map((user: any) => {
      const existingRecs = user.recommendedInternships;
      let recObj: { updatedAt: string; recommendedList: any[]; recommendedScores: any[] };

      if (existingRecs && typeof existingRecs === "object" && !Array.isArray(existingRecs)) {
        recObj = {
          updatedAt: existingRecs.updatedAt || user.recommendedUpdatedAt || new Date().toISOString(),
          recommendedList: Array.isArray(existingRecs.recommendedList) ? existingRecs.recommendedList : [],
          recommendedScores: Array.isArray(existingRecs.recommendedScores) ? existingRecs.recommendedScores : [],
        };
      } else if (Array.isArray(existingRecs)) {
        recObj = {
          updatedAt: user.recommendedUpdatedAt || user.updatedAt || new Date().toISOString(),
          recommendedList: existingRecs,
          recommendedScores: Array.isArray(user.recommendedScores) ? user.recommendedScores : [],
        };
      } else {
        recObj = {
          updatedAt: new Date().toISOString(),
          recommendedList: [],
          recommendedScores: [],
        };
      }

      const updatedUser = {
        ...user,
        recommendedInternships: recObj,
      };

      delete updatedUser.recommendedScores;
      delete updatedUser.recommendedUpdatedAt;

      return updatedUser;
    });

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(transformedUsers, null, 2), "utf8");
    console.log(`Successfully transformed ${transformedUsers.length} user documents in ${BACKUP_FILE}`);
  } else if (action === "restore") {
    if (!fs.existsSync(BACKUP_FILE)) {
      console.error(`Error: Backup file ${BACKUP_FILE} not found! Run fetch first.`);
      process.exit(1);
    }
    console.log(`Reading updated users from ${BACKUP_FILE}...`);
    const rawData = fs.readFileSync(BACKUP_FILE, "utf8");
    const users = JSON.parse(rawData);

    console.log(`Restoring ${users.length} users to MongoDB...`);
    let count = 0;
    for (const user of users) {
      const idStr = user._id?.$oid || user._id;
      const id = new mongoose.Types.ObjectId(idStr);
      const userCopy = { ...user };
      delete userCopy._id;
      userCopy._id = id;

      await collection.replaceOne({ _id: id }, userCopy, { upsert: true });
      count++;
    }
    console.log(`Successfully updated/replaced ${count} user documents in MongoDB.`);
  } else {
    console.log("Usage: npx tsx schema-refresher.ts [fetch|transform|restore]");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error in schema-refresher:", err);
  process.exit(1);
});
