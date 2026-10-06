import { connectDB } from "./db";
import mongoose from "mongoose";
import { vectoriserUrl } from "./services";

const BOOST_WEIGHT = 0.15;

async function setStatus(userId: string, status: "completed" | "failed") {
  try {
    await connectDB();
    await mongoose.connection.db?.collection("users").updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { vectorizationStatus: status } },
    );
  } catch (err) {
    console.error("[vectorizer] Could not update vectorizationStatus:", err);
  }
}

/**
 * A student's resume or profile changed: one request to the vectoriser (POST /encode-resume).
 * With user_id it saves the TF-IDF (15,000-d) and BERT (768-d) vectors on the student, and with recommend: true it
 * then runs the student through the WHOLE HNSW graph and saves their recommendations. This is the only time a
 * single student traverses the full graph; internship approvals re-run students inside the vectoriser itself.
 */
export async function vectorizeAndRecommendUser(userId: string, parsedData: unknown): Promise<boolean> {
  const base = vectoriserUrl();
  if (!base) {
    console.error("[vectorizer] VECTORISER_URL is not set, cannot vectorize the resume");
    await setStatus(userId, "failed");
    return false;
  }
  try {
    const res = await fetch(`${base}/encode-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: parsedData, boost_weight: BOOST_WEIGHT, user_id: userId, recommend: true }),
    });
    if (!res.ok) {
      console.error(`[vectorizer] /encode-resume failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
      await setStatus(userId, "failed");
      return false;
    }
    const { recommended } = await res.json();
    console.log(`[vectorizer] User ${userId}: vectors saved, ${recommended ?? 0} recommendations generated.`);
    await setStatus(userId, "completed");
    return true;
  } catch (err) {
    console.error("[vectorizer] Error in vectorizeAndRecommendUser:", err);
    await setStatus(userId, "failed");
    return false;
  }
}
